import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { copy } from "../src/copy.js";
import {
  breedSuggestions,
  filterBreeds,
  firstUnanswered,
  matchesBreed,
  sortBreeds,
  toggleCompare,
} from "../src/logic.js";
import { esc, renderPage } from "../src/render.js";
import { createStore } from "../src/store.js";
import site from "../content/site.json" with { type: "json" };

const empty = { q: "", ras: "", streek: "", grootte: "", gebruik: "", kleur: "", karakter: "" };

function state(over = {}) {
  return {
    site,
    path: "/",
    filters: { ...empty },
    saved: [],
    answers: {},
    compare: [],
    englishNames: false,
    gaitId: "stap",
    gaitStep: 0,
    bodyId: "oog",
    videoOn: false,
    quizIndex: 0,
    notice: "",
    ...over,
  };
}

test("published breed text is unchanged", () => {
  const hash = createHash("sha256").update(JSON.stringify(site.breeds)).digest("hex");
  assert.equal(hash, "1ff0649bd800b3dc5a3474dfbbc38579ea299137eb1767d27574f9eb5f612888");
});

test("every breed photo is already in the gids", async () => {
  assert.equal(site.breeds.length, 33);
  for (const breed of site.breeds) {
    await access(new URL(`../horses/${breed.slug}.jpg`, import.meta.url));
    assert.ok(breed.paragraphs.length > 0);
    assert.ok(breed.summary);
  }
});

test("filters and sort follow the published rules", () => {
  const belgie = filterBreeds(site.breeds, { ...empty, streek: "België" }, site.regionOrder);
  assert.ok(belgie.some((breed) => breed.slug === "ardenner"));
  assert.equal(belgie.some((breed) => breed.slug === "arabier"), false);
  const quiet = filterBreeds(site.breeds, { ...empty, karakter: "rustig", grootte: "zwaar" }, site.regionOrder);
  assert.ok(quiet.every((breed) => breed.tempTag === "rustig" && breed.size === "zwaar"));
  assert.equal(matchesBreed(site.breeds.find((breed) => breed.slug === "ijslander"), { ...empty, q: "tölt" }), true);
  const sorted = sortBreeds(site.breeds, site.regionOrder);
  assert.equal(sorted[0].slug, "ardenner");
  assert.equal(sorted.at(-1).regions.includes("Wereld"), true);
});

test("a near miss suggests the breed name and does not invent one", () => {
  const hits = breedSuggestions(site.breeds, "friees");
  assert.equal(hits[0].slug, "friese");
  assert.equal(breedSuggestions(site.breeds, "xyzqq").length, 0);
});

test("compare keeps two breeds", () => {
  const first = toggleCompare([], "fjord");
  const second = toggleCompare(first.list, "haflinger");
  const third = toggleCompare(second.list, "shire");
  assert.deepEqual(second.list, ["fjord", "haflinger"]);
  assert.equal(third.rejected, true);
  assert.deepEqual(third.list, ["fjord", "haflinger"]);
  const removed = toggleCompare(second.list, "fjord");
  assert.deepEqual(removed.list, ["haflinger"]);
});

test("favourites stay in the old localStorage shape", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const store = createStore(storage);
  store.toggleSaved("fjord");
  store.setAnswer("schoft", "b");
  store.toggleSaved("haflinger");
  assert.deepEqual(store.read().saved, ["fjord", "haflinger"]);
  assert.equal(store.read().answers.schoft, "b");
  const parsed = JSON.parse(storage.getItem("paarden-gids"));
  assert.deepEqual(parsed, { state: { saved: ["fjord", "haflinger"], answers: { schoft: "b" } }, version: 0 });
  store.resetAnswers();
  assert.deepEqual(JSON.parse(storage.getItem("paarden-gids")).state.saved, ["fjord", "haflinger"]);
  assert.deepEqual(JSON.parse(storage.getItem("paarden-gids")).state.answers, {});
});

test("quiz resumes at the first open question", () => {
  assert.equal(firstUnanswered(site.quiz, {}), 0);
  assert.equal(firstUnanswered(site.quiz, { [site.quiz[0].id]: "a" }), 1);
  const all = Object.fromEntries(site.quiz.map((item) => [item.id, item.answer]));
  assert.equal(firstUnanswered(site.quiz, all), site.quiz.length);
});

test("pages render the published words and mark open questions", () => {
  const home = renderPage(state());
  assert.match(home, new RegExp(copy.home.lede));
  assert.equal(home.includes("undefined"), false);
  assert.equal(home.includes("[object Object]"), false);
  const map = renderPage(state({ path: "/kaart" }));
  assert.match(map, /Nog te vragen aan Fien/);
  assert.match(map, /België/);
  const compare = renderPage(state({ path: "/vergelijk", compare: ["fjord", "haflinger"] }));
  assert.match(compare, /Nog te vragen aan Noa/);
  assert.match(compare, /Fjord/);
  assert.match(compare, /Haflinger/);
  const detail = renderPage(state({ path: "/rassen", filters: { ...empty, ras: "fjord" } }));
  const fjord = site.breeds.find((breed) => breed.slug === "fjord");
  assert.match(detail, new RegExp(fjord.paragraphs[0].slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const missing = renderPage(state({ path: "/rassen", filters: { ...empty, ras: "geen-ras" } }));
  assert.match(missing, /Ras niet gevonden/);
  const saved = renderPage(state({ path: "/favorieten" }));
  assert.match(saved, /Nog niets bewaard/);
  for (const path of ["/", "/rassen", "/kaart", "/vergelijk", "/favorieten", "/leren", "/beroepen", "/legendes", "/beroemd", "/verhalen", "/gangen", "/lichaam", "/leven", "/geschiedenis", "/verzorging", "/weetjes", "/woorden", "/check", "/nope"]) {
    const html = renderPage(state({ path }));
    assert.equal(html.includes("undefined"), false, path);
    assert.equal(html.includes("[object Object]"), false, path);
    for (const img of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(img[0], /\balt="/, path);
    }
  }
});

test("text is escaped", () => {
  assert.equal(esc(`<img src=x onerror=alert(1)>`), "&lt;img src=x onerror=alert(1)&gt;");
});
