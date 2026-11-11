import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
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
import { esc, renderNav, renderPage, shellStatus } from "../src/render.js";
import {
  VIDEO_PATH,
  bootMessage,
  byteRange,
  compareLabel,
  moveIndex,
  offlineBanner,
  photoMessage,
  photosFail,
  rasWord,
  saveLabel,
  shellCopy,
} from "../src/shell.js";
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

function contrast(hexA, hexB) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const channel = (value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const r = channel((n >> 16) & 255);
    const g = channel((n >> 8) & 255);
    const b = channel(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const left = lum(hexA);
  const right = lum(hexB);
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

test("shell colours stay light and readable", async () => {
  const css = await readFile(new URL("../app.css", import.meta.url), "utf8");
  const token = (name) => {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(match, name);
    return match[1];
  };
  const paper = token("paper");
  const card = token("card");
  const ink = token("ink");
  const muted = token("muted");
  const brass = token("brass");
  const moss = token("moss");
  const hay = token("hay");
  const line = token("line");
  assert.ok(contrast(muted, paper) >= 4.5);
  assert.ok(contrast(muted, card) >= 4.5);
  assert.ok(contrast(brass, paper) >= 4.5);
  assert.ok(contrast(brass, hay) >= 4.5);
  assert.ok(contrast(ink, paper) >= 7);
  assert.ok(contrast(paper, moss) >= 4.5);
  assert.ok(contrast(line, paper) >= 3);
  assert.ok(contrast(line, card) >= 3);
  assert.ok(contrast(line, hay) >= 3);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /prefers-contrast:\s*more/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /background:\s*Highlight/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /@media print/);
  assert.match(css, /@page/);
  assert.match(css, /\.breed-sheet/);
  assert.match(css, /max-height:\s*860px/);
});

test("open questions, titles and main buttons stay put", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.match(html, /<title>Alles over paarden<\/title>/);
  assert.match(html, /apple-mobile-web-app-title" content="Paarden"/);
  assert.equal(manifest.name, "Alles over paarden");
  assert.equal(manifest.short_name, "Paarden");
  assert.match(html, new RegExp(shellCopy.offlineBanner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(shellCopy.noscript.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const nav = renderNav("/kaart", 1);
  const labels = [...nav.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Start", "Rassen", "Kaart", "Vergelijk", "Bewaard"]);
  assert.match(nav, /aria-current="page"/);
  assert.match(nav, /Bewaard, 1 ras/);
  assert.match(renderNav("/", 2), /Bewaard, 2 rassen/);
  assert.equal(renderNav("/", 0).includes("0 ras"), false);
  const rassen = renderPage(state({ path: "/rassen" }));
  const map = renderPage(state({ path: "/kaart" }));
  const compare = renderPage(state({ path: "/vergelijk", compare: ["fjord", "haflinger"] }));
  assert.match(rassen, /De Engelse naam van een ras staat in de gids\. De uitleg is Nederlands\. Een Engelse tekst is er nog niet\./);
  assert.match(rassen, /Toon de Engelse naam/);
  assert.match(map, /Een wereldkaart met een stip per ras is er nog niet\./);
  assert.match(compare, /Nu passen er twee rassen naast elkaar\. Wil je er soms drie\?/);
  assert.equal((compare.match(/data-slot="/g) ?? []).length, 2);
  assert.equal(compare.includes('data-slot="2"'), false);
});

test("empty, missing and offline states tell a child what to do next", () => {
  const saved = renderPage(state({ path: "/favorieten" }));
  assert.match(saved, /Nog niets bewaard/);
  assert.match(saved, new RegExp(shellCopy.emptySavedNext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const noHits = renderPage(state({ path: "/rassen", filters: { ...empty, q: "xyzqq" } }));
  assert.match(noHits, new RegExp(copy.rassen.empty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(noHits, /De hele lijst komt terug/);
  assert.match(noHits, /results-empty/);
  const map = renderPage(state({ path: "/kaart" }));
  assert.match(map, /Tik een streek/);
  assert.match(map, /Daarna kun je een ras openen/);
  assert.match(map, /<span class="sr-only"> rassen<\/span>/);
  assert.match(map, /<span class="sr-only"> ras<\/span>/);
  const compare = renderPage(state({ path: "/vergelijk", compare: ["fjord"] }));
  assert.match(compare, /Kies nog een tweede ras/);
  assert.match(compare, /Daarna zie je de feiten naast elkaar/);
  assert.match(compare, /van twee/);
  const missing = renderPage(state({ path: "/nope" }));
  assert.match(missing, /Deze bladzijde staat niet in de gids/);
  assert.match(missing, /href="\/rassen">Rassen/);
  assert.match(missing, /href="\/bewaard"|href="\/favorieten">Bewaard/);
  const offlineHome = renderPage(state({ online: false }));
  assert.equal(offlineHome.includes(".mp4"), false);
  assert.match(offlineHome, /korte opname heeft internet nodig/);
  const cachedVideo = renderPage(state({ online: false, videoCached: true, videoOn: true }));
  assert.match(cachedVideo, /\/horses\/weide\.mp4/);
  assert.equal(offlineBanner(true), shellCopy.offlineBannerSaved);
  assert.equal(offlineBanner(false), shellCopy.offlineBanner);
  const playing = renderPage(state({ videoOn: true }));
  assert.match(playing, /\/horses\/weide\.mp4/);
  assert.match(playing, /autoplay/);
  const calm = renderPage(state({ videoOn: true, reduceMotion: true }));
  assert.equal(calm.includes("autoplay"), false);
  assert.match(calm, /\/horses\/weide\.mp4/);
});

test("breed and compare pages name controls and keep the published fields", () => {
  const detail = renderPage(state({ path: "/rassen", filters: { ...empty, ras: "fjord" }, saved: ["fjord"], compare: ["fjord"] }));
  assert.match(detail, /class="breed-sheet"/);
  assert.match(detail, new RegExp(saveLabel("Fjord", true).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(detail, new RegExp(compareLabel("Fjord", true).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(detail, /Bewaard/);
  assert.match(detail, /Gekozen/);
  assert.match(detail, /Norwegian Fjord/);
  const compare = renderPage(state({ path: "/vergelijk", compare: ["fjord", "haflinger"] }));
  assert.match(compare, /Onderwerp/);
  assert.match(compare, /Engelse naam/);
  assert.match(compare, /Schofthoogte/);
  assert.match(compare, /role="region"/);
  const gaits = renderPage(state({ path: "/gangen" }));
  assert.match(gaits, /role="tablist"/);
  assert.match(gaits, /aria-controls="gang-pane"/);
  assert.match(gaits, /tabindex="-1"/);
  assert.match(gaits, /print-only/);
  assert.match(gaits, /screen-only/);
  const bodyPage = renderPage(state({ path: "/lichaam" }));
  assert.match(bodyPage, /print-only/);
  assert.ok(bodyPage.split("print-only")[1].includes("<h2>"));
  assert.equal(shellStatus(state({ path: "/favorieten" })), `${copy.savedPage.empty} ${shellCopy.emptySavedNext}`);
  assert.match(shellStatus(state({ path: "/gangen" })), /Stap/);
  assert.match(shellStatus(state({ path: "/nope" })), /Deze bladzijde staat niet in de gids/);
  assert.match(bootMessage(false), /nog niet op deze tablet/);
  assert.equal(photoMessage("Fjord", false).includes("offline"), true);
  assert.equal(photosFail(1, true), "");
  assert.match(photosFail(3, false), /3 foto's/);
  assert.equal(rasWord(1), "ras");
  assert.equal(moveIndex(0, 4, "ArrowRight"), 1);
  assert.equal(moveIndex(0, 4, "ArrowLeft"), 3);
  assert.equal(moveIndex(2, 4, "Home"), 0);
  assert.equal(moveIndex(2, 4, "End"), 3);
  assert.equal(moveIndex(1, 4, "Enter"), null);
});

test("text size stays out of the favourites record", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const store = createStore(storage);
  store.toggleSaved("fjord");
  store.setTextSize("groot");
  store.setEnglishNames(true);
  assert.deepEqual(JSON.parse(storage.getItem("paarden-gids")), {
    state: { saved: ["fjord"], answers: {} },
    version: 0,
  });
  assert.deepEqual(JSON.parse(storage.getItem("paarden-gids-voorkeur")), {
    englishNames: true,
    textSize: "groot",
  });
  store.setTextSize("anders");
  assert.equal(store.read().textSize, "gewoon");
  assert.equal(store.read().englishNames, true);
  assert.deepEqual(store.read().saved, ["fjord"]);
});

test("the meadow recording is cached, and no other video is added", async () => {
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.equal(VIDEO_PATH, "/horses/weide.mp4");
  assert.match(sw, /VIDEO_PATH/);
  assert.match(sw, /Content-Range/);
  assert.match(sw, /endsWith\("\.mp4"\)/);
  assert.match(sw, /paarden-gids-shell-v3/);
  assert.match(sw, /nog niet bewaard/);
  assert.match(sw, /src\/shell\.js/);
  assert.match(app, /type:\s*"module"/);
  assert.deepEqual(byteRange(1000, "bytes=0-99"), { start: 0, end: 99, total: 1000 });
  assert.deepEqual(byteRange(1000, "bytes=0-"), { start: 0, end: 999, total: 1000 });
  assert.deepEqual(byteRange(1000, "bytes=-100"), { start: 900, end: 999, total: 1000 });
  assert.equal(byteRange(1000, "bytes=1000-"), null);
  assert.equal(byteRange(1000, "notes"), null);
});
