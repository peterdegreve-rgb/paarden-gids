// Copies horse content out of the published bundles.
// The words belong to Fien and Noa. This script does not rewrite them.
// content/site.json is the snapshot the shell ships. Re-run only when assets/ still exists.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

if (!existsSync(new URL("../assets/ui-bits-CBLFltVe.js", import.meta.url))) {
  console.log("content/site.json is already the content snapshot. The old bundles are gone, so there is nothing to extract.");
  process.exit(0);
}
const ui = await import("../assets/ui-bits-CBLFltVe.js");
const idx = await import("../assets/index-C66ZT8Jq.js");
const lore = await import("../assets/lore-So25Ik_q.js");
const more = await import("../assets/more-DlieETKN.js");

const site = {
  note: "Paardenfeiten, verhalen en fotobijschriften komen uit de gepubliceerde gids. Niet herschrijven. Inhoud is van Fien en Noa. De app-schil leest dit bestand alleen.",
  breeds: ui.o,
  filters: {
    streek: ui.l,
    grootte: ui.d,
    gebruik: ui.m,
    kleur: ui.s,
    karakter: ui.p,
  },
  sizeLabels: {
    klein: "Klein",
    middel: "Middelgroot",
    groot: "Groot",
    zwaar: "Zwaar trektype",
  },
  regionOrder: ["België", "Nederland", "Duitsland", "Frankrijk", "Luxemburg", "Wereld"],
  learn: idx.l,
  care: idx.a,
  history: idx.c,
  life: idx.u,
  facts: idx.o,
  glossary: idx.s,
  body: idx.i,
  quiz: idx.d,
  jobs: more.i,
  legends: { kinds: lore.n, items: lore.r },
  famous: lore.t,
  stories: more.r,
  gaits: more.t,
  hooves: more.n,
};

mkdirSync(new URL("../content/", import.meta.url), { recursive: true });
writeFileSync(new URL("../content/site.json", import.meta.url), JSON.stringify(site, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      breeds: site.breeds.length,
      heavy: site.breeds.filter((b) => b.size === "zwaar").map((b) => b.slug),
      learn: site.learn.length,
      quiz: site.quiz.length,
      facts: site.facts.length,
      glossary: site.glossary.length,
      body: site.body.length,
      jobs: site.jobs.length,
      legends: site.legends.items.length,
      famous: site.famous.length,
      stories: site.stories.length,
      gaits: site.gaits.length,
      bodyNoPoint: site.body.filter((p) => p.x == null).map((p) => p.id),
    },
    null,
    2,
  ),
);
