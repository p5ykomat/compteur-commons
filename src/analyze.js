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
  limit = 50,
  run,
  update = () => {},
  request = mediaWikiRequest,
  Parser,
}) {
  const query = normalizeQuery(values[0], mode);
  const files = new Map();
  let continuation = null;
  let truncated = false;
  do {
    run.status(`Repérage des fichiers : ${files.size}`);
    const data = await request(
      API,
      {
        list: "exturlusage",
        euprop: "ids|title|url",
        eulimit: "max",
        eunamespace: 6,
        euquery: query.apiQuery,
        ...(continuation || {}),
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
      const file = files.get(row.title);
      if (!file.indexedUrls.includes(row.url)) file.indexedUrls.push(row.url);
      if (files.size >= limit) {
        truncated = Boolean(data.continue) || i < rows.length - 1;
        break;
      }
    }
    continuation = truncated ? null : continuationParams(data);
  } while (continuation);
  const results = [];
  let n = 0;
  for (const file of files.values()) {
    if (run.aborted) throw new Error("Analyse arrêtée.");
    run.status(`Lecture des pages : ${++n} / ${files.size}`);
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
        throw new Error("Page non lisible.");
      results.push({
        ...file,
        ...classifyCommonsHtml(data.parse.text, query, Parser),
        revision: data.parse.revid,
        url: pageUrl("https://commons.wikimedia.org", file.title),
      });
    } catch (error) {
      if (run.aborted) throw error;
      results.push({
        ...file,
        status: "unverified",
        evidence: [],
        error: error.message,
        url: pageUrl("https://commons.wikimedia.org", file.title),
      });
    }
    update(n, files.size);
  }
  return {
    query,
    files: results,
    truncated,
    scannedAt: new Date(),
    candidateCount: files.size,
  };
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
