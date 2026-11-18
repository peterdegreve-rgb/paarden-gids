// shell: true — tablet chrome sentences, not published gids text.
// Strings in src/copy.js stay as they are.

export const TEXT_SIZES = ["klein", "gewoon", "groot"];
export const VIDEO_PATH = "/horses/weide.mp4";

export const shellCopy = {
  offlineBanner:
    "Je bent offline. De tekst en de foto's op deze tablet blijven. De korte opname niet. Kies Start, Rassen of Bewaard om verder te lezen.",
  offlineBannerSaved:
    "Je bent offline. De tekst, de foto's en de korte opname op deze tablet blijven. Kies Start, Rassen of Bewaard om verder te lezen.",
  onlineAgain: "Je bent weer online. De korte opname kan weer, als je erom vraagt.",
  bootTitle: "De gids kon niet openen.",
  bootOffline:
    "Je bent offline, en de tekst stond nog niet op deze tablet. Ga online en tik daarna op Opnieuw proberen.",
  bootOnline: "De tekst kwam niet door. Tik op Opnieuw proberen.",
  bootNext:
    "Lukt het daarna, dan blijven de bladzijden op deze tablet. De korte opname heeft altijd internet nodig.",
  retry: "Opnieuw proberen",
  pageFailTitle: "Deze bladzijde kon niet openen.",
  pageFail: "De rest van de gids staat nog klaar. Ga naar de start, of probeer deze bladzijde opnieuw.",
  toStart: "Naar de start",
  photoTitle: "Foto niet geladen",
  photoRetry: "Probeer de foto opnieuw",
  emptyRassenNext: "De hele lijst komt terug als de filters leeg zijn.",
  emptySavedNext: "Tik bij een ras op Bewaren. De lijst blijft op deze tablet staan.",
  emptyRegion: "In deze streek staat geen ras. Tik een andere streek, of kies Wereld.",
  emptyMap: "Tik een streek. De rassen uit de gids komen hieronder.",
  emptyMapNext: "Daarna kun je een ras openen.",
  emptyCompareNone: "Kies twee rassen. Op elke kaart staat ook een knop Vergelijk.",
  emptyCompareOne: "Kies nog een tweede ras.",
  emptyCompareNext: "Daarna zie je de feiten naast elkaar.",
  missingBreedNext: "Kies een ras uit de lijst, of ga terug.",
  missingPage: "Deze bladzijde staat niet in de gids. Kies Start, Rassen, Kaart, Vergelijk of Bewaard.",
  videoOffline:
    "Je bent offline. De korte opname heeft internet nodig. De foto blijft staan en de rest van de gids kun je lezen.",
  videoLabel: "Speel de korte opname",
  videoReady: "De korte opname staat klaar. Tik op afspelen in de speler.",
  videoName: "Korte opname van paarden in de weide",
  closeVideo: "Terug naar de foto",
  noscript: "De gids heeft JavaScript nodig. Zet het aan op deze tablet en open de pagina opnieuw.",
  swOffline:
    "Je bent offline, en deze tablet heeft de gids nog niet bewaard. Ga online en open de gids één keer. Daarna blijven de tekst en de foto's hier staan. De korte opname niet: die heeft altijd internet nodig.",
};

export function normalizeTextSize(value) {
  return value === "klein" || value === "groot" ? value : "gewoon";
}

export function textSizeStatus(size) {
  if (size === "klein") return "Kleine tekst.";
  if (size === "groot") return "Grote tekst.";
  return "Gewone tekst.";
}

export function rasWord(count) {
  return Number(count) === 1 ? "ras" : "rassen";
}

export function moveIndex(index, length, key) {
  if (!length || length < 1) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % length;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

export function photoMessage(alt, online) {
  const name = String(alt || "").trim() || "deze foto";
  if (online) return `De foto (${name}) kwam niet door. De tekst kun je wel lezen.`;
  return `Je bent offline. De foto (${name}) stond nog niet op de tablet. De tekst kun je wel lezen.`;
}

export function photosFail(count, online) {
  const n = Number(count) || 0;
  if (n <= 1) return "";
  if (online) return `${n} foto's kwamen niet door. De tekst kun je wel lezen.`;
  return `Je bent offline. ${n} foto's stonden nog niet op de tablet. De tekst kun je wel lezen.`;
}

export function saveLabel(name, on) {
  return on ? `${name} staat bij bewaard. Tik om het weg te halen.` : `Bewaar ${name}`;
}

export function compareLabel(name, on) {
  return on
    ? `${name} staat klaar om te vergelijken. Tik om het weg te halen.`
    : `Zet ${name} klaar om te vergelijken`;
}

export function savedStatus(name, on) {
  return on ? `${name} staat bij bewaard, op deze tablet.` : `${name} staat niet meer bij bewaard.`;
}

export function offlineBanner(videoCached) {
  return videoCached ? shellCopy.offlineBannerSaved : shellCopy.offlineBanner;
}

// Byte range for the cached meadow recording. A video element asks for slices.
export function byteRange(total, header) {
  const size = Number(total) || 0;
  if (!header || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!match) return null;
  const suffix = match[1] === "" && match[2] !== "";
  let start;
  let end;
  if (suffix) {
    const tail = Number(match[2]);
    if (!Number.isFinite(tail) || tail <= 0) return null;
    start = Math.max(0, size - tail);
    end = size - 1;
  } else {
    start = match[1] === "" ? 0 : Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= size || end < start) return null;
  end = Math.min(end, size - 1);
  return { start, end, total: size };
}

export function bootMessage(online) {
  const why = online ? shellCopy.bootOnline : shellCopy.bootOffline;
  return `${shellCopy.bootTitle} ${why} ${shellCopy.bootNext}`;
}
