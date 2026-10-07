import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "linkedom";
import { classifyCommonsHtml, runSearch, loadUsage } from "../src/analyze.js";
import { normalizeQuery } from "../src/utils.js";
import { createRun } from "../src/mediawiki.js";
const q = normalizeQuery("library.example", "domain");
const a = '<a href="https://library.example/item/1">notice</a>';
test("champ source rendu, y compris HTML produit par un modèle imbriqué", () => {
  const r = classifyCommonsHtml(
    `<table><tr><td id="fileinfotpl_src">Source</td><td><span>${a}</span></td></tr></table>`,
    q,
    DOMParser,
  );
  assert.equal(r.status, "source");
  assert.equal(r.evidence[0].url, "https://library.example/item/1");
});
test("section Source hors modèle, et limite à la section suivante", () => {
  assert.equal(
    classifyCommonsHtml(`<h2>Source</h2><p>${a}</p>`, q, DOMParser).status,
    "source",
  );
  assert.equal(
    classifyCommonsHtml(
      `<h2>Source</h2><p>Autre collection</p><h2>Description</h2><p>${a}</p>`,
      q,
      DOMParser,
    ).status,
    "other",
  );
});
test("institution distincte de la source et description distincte des deux", () => {
  for (const [id, status] of [
    ["fileinfotpl_art_institution", "institution"],
    ["fileinfotpl_desc", "other"],
  ])
    assert.equal(
      classifyCommonsHtml(
        `<table><tr><td id="${id}">Champ</td><td>${a}</td></tr></table>`,
        q,
        DOMParser,
      ).status,
      status,
    );
});
test("domaine ressemblant, commentaire et texte de lien ne sont pas des correspondances", () => {
  for (const html of [
    '<a href="https://notlibrary.example">notice</a>',
    `<!--${a}-->`,
    '<a href="https://other.example">library.example</a>',
  ])
    assert.equal(classifyCommonsHtml(html, q, DOMParser).status, "unverified");
});
test("URL exacte, casse du chemin, paramètres et entités HTML", () => {
  const exact = normalizeQuery("https://library.example/Item?a=1&b=2", "url");
  assert.equal(
    classifyCommonsHtml(
      '<h2>Source</h2><a href="https://library.example/Item?a=1&amp;b=2">notice</a>',
      exact,
      DOMParser,
    ).status,
    "source",
  );
  assert.equal(
    classifyCommonsHtml(
      '<h2>Source</h2><a href="https://library.example/item?a=1&amp;b=2">notice</a>',
      exact,
      DOMParser,
    ).status,
    "unverified",
  );
});
test("pagination, fichier dédoublonné et panne de lecture conservée", async () => {
  let n = 0;
  const request = async (api, p) => {
    if (p.action === "parse") {
      if (p.page === "File:B") throw new Error("Indisponible");
      return { parse: { text: `<h2>Source</h2>${a}`, revid: 7 } };
    }
    n++;
    return n === 1
      ? {
          continue: { eucontinue: "x" },
          query: {
            exturlusage: [
              {
                ns: 6,
                title: "File:A",
                pageid: 1,
                url: "https://library.example/item/1",
              },
            ],
          },
        }
      : {
          query: {
            exturlusage: [
              {
                ns: 6,
                title: "File:A",
                pageid: 1,
                url: "https://library.example/item/2",
              },
              {
                ns: 6,
                title: "File:B",
                pageid: 2,
                url: "https://library.example/item/3",
              },
            ],
          },
        };
  };
  const r = await runSearch({
    values: ["library.example"],
    mode: "domain",
    run: createRun(),
    request,
    Parser: DOMParser,
  });
  assert.equal(n, 2);
  assert.equal(r.files.length, 2);
  assert.equal(r.files[0].status, "source");
  assert.equal(r.files[1].status, "unverified");
  assert.equal(r.files[1].error, "Indisponible");
});
test("limite avant contrôle explicitement signalée", async () => {
  const request = async (api, p) =>
    p.action === "parse"
      ? { parse: { text: a, revid: 1 } }
      : {
          continue: { eucontinue: "x" },
          query: {
            exturlusage: [
              { ns: 6, title: "File:A", url: "https://library.example/item/1" },
            ],
          },
        };
  const r = await runSearch({
    values: ["library.example"],
    mode: "domain",
    limit: 1,
    run: createRun(),
    request,
    Parser: DOMParser,
  });
  assert.equal(r.truncated, true);
});
test("réutilisations paginées et dédoublonnées par wiki et page", async () => {
  const request = async (api, p) =>
    p.prop === "fileusage"
      ? { query: { pages: [{ fileusage: [{ title: "Gallery", ns: 0 }] }] } }
      : p.gucontinue
        ? {
            query: {
              pages: [
                {
                  globalusage: [
                    {
                      title: "Article",
                      wiki: "frwiki",
                      ns: 0,
                      url: "https://fr.wikipedia.org/wiki/Article",
                    },
                  ],
                },
              ],
            },
          }
        : {
            continue: { gucontinue: "x" },
            query: {
              pages: [
                {
                  globalusage: [
                    {
                      title: "Article",
                      wiki: "frwiki",
                      ns: 0,
                      url: "https://fr.wikipedia.org/wiki/Article",
                    },
                  ],
                },
              ],
            },
          };
  assert.equal(
    (await loadUsage({ title: "File:A" }, createRun(), request)).length,
    2,
  );
});
