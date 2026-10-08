import { t } from "./i18n.js";
import { mediaWikiRequest, continuationParams } from "./mediawiki.js";
import { normalizeQuery, pageUrl } from "./utils.js";
import {
  parseHtml,
  matchingLinks,
  sectionFor,
  normalizedLabel,
} from "./html.js";
const API = "https://commons.wikimedia.org/w/api.php";

export function classifyCommonsHtml(html, query, Parser) {
  const doc = parseHtml(html, Parser);
  const evidence = matchingLinks(doc, query).map(({ node, url }) => {
    const row = node.closest("tr");
    const first = row?.querySelector("th,td");
    const id = first?.id || "";
    const label = normalizedLabel(first?.textContent);
    const heading = sectionFor(node, doc);
    const section = normalizedLabel(heading?.textContent);
    let context = "other";
    if (
      id === "fileinfotpl_src" ||
      (first &&
        !first.contains(node) &&
        /^(source|sources|provenance)$/.test(label))
    )
      context = "source";
    else if (
      /^fileinfotpl.*institution/.test(id) ||
      (first &&
        !first.contains(node) &&
        /^(institution|collection|repository)$/.test(label))
    )
      context = "institution";
    else if (
      id === "fileinfotpl_desc" ||
      (first &&
        !first.contains(node) &&
        /^(description|descriptif)$/.test(label))
    )
      context = "description";
    else if (/^(source|sources|provenance)$/.test(section)) context = "source";
    else if (/^(description|summary|resume)$/.test(section))
      context = "description";
    return {
      url,
      context,
      excerpt: (node.closest("td,li,p")?.textContent || node.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 320),
    };
  });
  const unique = [
    ...new Map(evidence.map((e) => [`${e.context}:${e.url}`, e])).values(),
  ];
  const status = unique.some((e) => e.context === "source")
    ? "source"
    : unique.some((e) => e.context === "institution")
      ? "institution"
      : unique.length
        ? "other"
        : "unverified";
  return { status, evidence: unique };
}

export async function runSearch({
  values,
  mode,
  limit = 0,
  run,
  update = () => {},
  request = mediaWikiRequest,
  Parser,
  checkpoint,
  onCheckpoint = () => {},
}) {
  const query = normalizeQuery(values[0], mode),
    signature = JSON.stringify([query.mode, query.display, limit]);
  const state =
    checkpoint?.signature === signature
      ? checkpoint
      : {
          signature,
          files: [],
          read: {},
          continuation: null,
          discoveryDone: false,
          truncated: false,
          startedAt: new Date().toISOString(),
        };
  delete state.error;
  function snapshot() {
    const files = state.files.map(
      (f) =>
        state.read[f.title] || {
          ...f,
          status: "unverified",
          evidence: [],
          url: pageUrl("https://commons.wikimedia.org", f.title),
          error: t("Lecture en attente."),
        },
    );
    const partial =
      !state.discoveryDone ||
      Boolean(state.error) ||
      files.some((f) => f.error);
    return {
      query,
      files,
      truncated: state.truncated,
      scannedAt: new Date(),
      startedAt: state.startedAt,
      candidateCount: state.files.length,
      discoveryComplete: state.discoveryDone,
      partial,
      canResume: partial,
      collectionError: state.error,
    };
  }
  const save = () => onCheckpoint(state, snapshot());
  const files = new Map(state.files.map((f) => [f.title, f]));
  try {
    while (!state.discoveryDone && !run.aborted) {
      run.status(t`Repérage des fichiers : ${files.size}`);
      const data = await request(
        API,
        {
          list: "exturlusage",
          euprop: "ids|title|url",
          eulimit: 100,
          eunamespace: 6,
          euquery: query.apiQuery,
          ...(state.continuation || {}),
        },
        run,
      );
      const rows = data.query?.exturlusage || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.ns !== 6 || !row.title || !query.matches(row.url)) continue;
        if (!files.has(row.title))
          files.set(row.title, {
            title: row.title,
            pageid: row.pageid,
            indexedUrls: [],
          });
        const f = files.get(row.title);
        if (!f.indexedUrls.includes(row.url)) f.indexedUrls.push(row.url);
        if (limit > 0 && files.size >= limit) {
          state.truncated = Boolean(data.continue) || i < rows.length - 1;
          state.discoveryDone = true;
          break;
        }
      }
      state.files = [...files.values()];
      state.continuation = continuationParams(data);
      if (!state.continuation) state.discoveryDone = true;
      save();
    }
  } catch (e) {
    state.error = run.aborted ? t("Relevé mis en pause.") : e.message;
    save();
  }
  let n = 0;
  for (const file of state.files) {
    if (run.aborted) break;
    n++;
    if (state.read[file.title] && !state.read[file.title].error) continue;
    run.status(t`Lecture des pages : ${n} / ${state.files.length}`);
    try {
      const data = await request(
        API,
        {
          action: "parse",
          page: file.title,
          prop: "text|revid",
          disableeditsection: 1,
        },
        run,
      );
      if (typeof data.parse?.text !== "string")
        throw new Error(t("Page non lisible."));
      state.read[file.title] = {
        ...file,
        ...classifyCommonsHtml(data.parse.text, query, Parser),
        revision: data.parse.revid,
        url: pageUrl("https://commons.wikimedia.org", file.title),
      };
    } catch (e) {
      state.read[file.title] = {
        ...file,
        status: "unverified",
        evidence: [],
        error: run.aborted ? t("Lecture mise en pause.") : e.message,
        url: pageUrl("https://commons.wikimedia.org", file.title),
      };
      if (run.aborted) {
        save();
        break;
      }
    }
    update(n, state.files.length);
    save();
  }
  save();
  return snapshot();
}

export async function loadUsage(file, run, request = mediaWikiRequest) {
  const output = [];
  for (const prop of ["fileusage", "globalusage"]) {
    let continuation = null;
    do {
      const data = await request(
        API,
        {
          prop,
          titles: file.title,
          ...(prop === "fileusage"
            ? { fulimit: "max", fuprop: "title|pageid|namespace" }
            : { gulimit: "max", guprop: "url|pageid|namespace" }),
          ...(continuation || {}),
        },
        run,
      );
      for (const page of data.query?.pages || [])
        for (const row of page[prop] || [])
          output.push({
            wiki: row.wiki || "commonswiki",
            title: row.title,
            namespace: row.ns ?? row.namespace,
            url: row.url || pageUrl("https://commons.wikimedia.org", row.title),
          });
      continuation = continuationParams(data);
    } while (continuation);
  }
  file.usage = [
    ...new Map(output.map((r) => [`${r.wiki}:${r.title}`, r])).values(),
  ];
  return file.usage;
}
