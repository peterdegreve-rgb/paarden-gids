import { firstUnanswered, parseFilters, toggleCompare } from "./src/logic.js";
import { esc, pageTitle, renderGids, renderNav, renderPage, shellStatus } from "./src/render.js";
import {
  VIDEO_PATH,
  bootMessage,
  moveIndex,
  normalizeTextSize,
  offlineBanner,
  photoMessage,
  photosFail,
  savedStatus,
  shellCopy,
  textSizeStatus,
} from "./src/shell.js";
import { createStore } from "./src/store.js";

const store = createStore(localStorage);
const emptyFilters = { q: "", ras: "", streek: "", grootte: "", gebruik: "", kleur: "", karakter: "" };

const state = {
  site: null,
  bootError: false,
  path: "/",
  filters: { ...emptyFilters },
  saved: [],
  answers: {},
  compare: [],
  englishNames: false,
  textSize: "gewoon",
  gaitId: "stap",
  gaitStep: 0,
  bodyId: "oog",
  videoOn: false,
  quizIndex: 0,
  notice: "",
  online: true,
  videoCached: false,
  reduceMotion: false,
};

const main = document.querySelector("#inhoud");
const dialog = document.querySelector("#gids");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function normalize(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

function readLocation() {
  state.path = normalize(location.pathname);
  state.filters = parseFilters(location.search);
}

function errorHtml() {
  const online = navigator.onLine;
  return `<div class="empty">
    <h1>${esc(shellCopy.bootTitle)}</h1>
    <p>${esc(online ? shellCopy.bootOnline : shellCopy.bootOffline)}</p>
    <p>${esc(shellCopy.bootNext)}</p>
    <button type="button" class="btn btn-moss" data-action="retry">${esc(shellCopy.retry)}</button>
  </div>`;
}

function pageFailHtml() {
  return `<div class="empty">
    <h1>${esc(shellCopy.pageFailTitle)}</h1>
    <p>${esc(shellCopy.pageFail)}</p>
    <p><a class="text-link" href="/">${esc(shellCopy.toStart)}</a></p>
    <button type="button" class="btn btn-line" data-action="retry">${esc(shellCopy.retry)}</button>
  </div>`;
}

function say(message, { urgent = false } = {}) {
  const node = document.querySelector(urgent ? "#alarm" : "#zeg");
  if (!node || !message || node.dataset.current === message) return;
  node.dataset.current = message;
  if (!urgent) {
    node.textContent = message;
    return;
  }
  node.textContent = "";
  window.setTimeout(() => {
    if (node.dataset.current === message) node.textContent = message;
  }, 40);
}

function applyTextSize(size) {
  const next = normalizeTextSize(size);
  state.textSize = next;
  document.documentElement.dataset.text = next;
  for (const button of document.querySelectorAll("[data-action='text-size']")) {
    const on = button.dataset.size === next;
    button.setAttribute("aria-checked", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
  }
  return next;
}

function paint({ scroll = "keep", focusKey = null, status = null } = {}) {
  const active = document.activeElement;
  const key = focusKey || active?.dataset?.focusKey || active?.id || "";
  const caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  document.body.dataset.page = state.path || "/";
  try {
    document.title = state.site ? pageTitle(state) : "Alles over paarden";
    if (state.bootError || !state.site) main.innerHTML = errorHtml();
    else main.innerHTML = renderPage(state);
  } catch {
    main.innerHTML = pageFailHtml();
    say(`${shellCopy.pageFailTitle} ${shellCopy.pageFail}`, { urgent: true });
    return;
  }
  const nav = document.querySelector("#tabbar");
  if (nav) nav.innerHTML = state.site ? renderNav(state.path, state.saved.length) : "";
  const gidsButton = document.querySelector("#gids-open");
  if (gidsButton) {
    gidsButton.disabled = !state.site;
    gidsButton.setAttribute("aria-expanded", dialog.open ? "true" : "false");
  }
  const alarm = document.querySelector("#alarm");
  if (alarm && !state.bootError) {
    alarm.textContent = "";
    delete alarm.dataset.current;
  }
  if (state.bootError) say(bootMessage(navigator.onLine), { urgent: true });
  else say(status ?? shellStatus(state));

  if (scroll === "top") {
    window.scrollTo(0, 0);
    main.scrollTop = 0;
    main.focus({ preventScroll: true });
    return;
  }
  if (scroll === "hash" && location.hash.length > 1) {
    try {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    } catch {
      /* ignore a broken hash */
    }
  }
  if (!key) return;
  const next = main.querySelector(`[data-focus-key="${CSS.escape(key)}"]`) || document.getElementById(key);
  if (!next) return;
  next.focus({ preventScroll: true });
  if (caret != null && typeof next.setSelectionRange === "function") {
    const at = Math.min(caret, next.value.length);
    next.setSelectionRange(at, at);
  }
}

function go(url, { replace = false } = {}) {
  const next = new URL(url, location.origin);
  history[replace ? "replaceState" : "pushState"]({}, "", `${next.pathname}${next.search}${next.hash}`);
  readLocation();
  state.notice = "";
  paint({ scroll: next.hash ? "hash" : "top" });
}

function sameBreed(slug) {
  return state.site.breeds.some((breed) => breed.slug === slug);
}

function breedName(slug) {
  return state.site?.breeds.find((breed) => breed.slug === slug)?.name ?? "Dit ras";
}

function handleAction(el) {
  const action = el.dataset.action;
  if (action === "text-size") {
    const next = store.setTextSize(el.dataset.size);
    applyTextSize(next);
    if (!state.site && !state.bootError) {
      say(textSizeStatus(next));
      return;
    }
    paint({ scroll: "keep", focusKey: `text-${next}`, status: textSizeStatus(next) });
    return;
  }
  if (action === "retry") {
    location.reload();
    return;
  }
  if (action === "close-gids") {
    dialog.close();
    return;
  }
  if (!state.site) return;

  if (action === "filter") {
    const key = el.dataset.key;
    const value = el.dataset.value;
    const filters = { ...state.filters, ras: "", [key]: state.filters[key] === value ? "" : value };
    history.replaceState({}, "", `/rassen${query(filters)}`);
    readLocation();
    state.notice = "";
    paint();
    return;
  }
  if (action === "clear-filters") {
    history.replaceState({}, "", "/rassen");
    readLocation();
    paint();
    return;
  }
  if (action === "save") {
    const was = state.saved.includes(el.dataset.slug);
    state.saved = store.toggleSaved(el.dataset.slug);
    paint({ scroll: "keep", status: savedStatus(breedName(el.dataset.slug), !was) });
    return;
  }
  if (action === "compare") {
    const result = toggleCompare(state.compare, el.dataset.slug, 2);
    state.compare = store.setCompare(result.list);
    state.notice = result.rejected ? "Je kunt er twee vergelijken. Haal er eerst één weg." : "";
    paint();
    return;
  }
  if (action === "map") {
    const value = el.dataset.value;
    const streek = state.filters.streek === value ? "" : value;
    history.replaceState({}, "", streek ? `/kaart?streek=${encodeURIComponent(streek)}` : "/kaart");
    readLocation();
    paint();
    return;
  }
  if (action === "gait") {
    state.gaitId = el.dataset.value;
    state.gaitStep = 0;
    paint();
    return;
  }
  if (action === "next-step") {
    const gait = state.site.gaits.find((item) => item.id === state.gaitId) ?? state.site.gaits[0];
    state.gaitStep = (state.gaitStep + 1) % gait.steps.length;
    paint();
    return;
  }
  if (action === "body") {
    state.bodyId = el.dataset.value;
    paint();
    return;
  }
  if (action === "play-video") {
    if (navigator.onLine || state.videoCached) {
      state.videoOn = true;
      paint({
        focusKey: "hero-video",
        status: state.reduceMotion ? shellCopy.videoReady : shellCopy.videoName,
      });
    } else {
      state.videoOn = "offline";
      state.online = false;
      paint({ focusKey: "play-video", status: shellCopy.videoOffline });
    }
    return;
  }
  if (action === "close-video") {
    state.videoOn = false;
    paint({ focusKey: "play-video" });
    return;
  }
  if (action === "answer") {
    const id = el.dataset.id;
    if (state.answers[id]) return;
    state.answers = store.setAnswer(id, el.dataset.value);
    paint({ focusKey: "quiz-next" });
    return;
  }
  if (action === "next-quiz") {
    state.quizIndex += 1;
    paint({ scroll: "top" });
    return;
  }
  if (action === "reset-quiz") {
    state.answers = store.resetAnswers();
    state.quizIndex = 0;
    paint({ scroll: "top" });
  }
}

function query(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function applyBanner() {
  const banner = document.querySelector("#offline");
  if (!banner) return;
  banner.textContent = offlineBanner(state.videoCached);
  banner.hidden = state.online;
}

async function refreshVideoCache() {
  if (!("caches" in window)) return;
  try {
    state.videoCached = Boolean(await caches.match(VIDEO_PATH));
  } catch {
    state.videoCached = false;
  }
  applyBanner();
}

function syncNet() {
  const online = navigator.onLine;
  const changed = state.online !== online;
  state.online = online;
  applyBanner();
  if (!changed) return;
  if (!online && state.videoOn === true && !state.videoCached) state.videoOn = "offline";
  const status = online ? shellCopy.onlineAgain : offlineBanner(state.videoCached);
  if (state.site && !state.bootError) paint({ scroll: "keep", status });
  else if (!online) say(status);
}

document.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (actionEl && !["INPUT", "SELECT", "TEXTAREA"].includes(actionEl.tagName)) {
    event.preventDefault();
    handleAction(actionEl);
    return;
  }
  const link = event.target.closest("a[href]");
  if (!link || link.origin !== location.origin) return;
  if (link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (dialog.open) dialog.close();
  go(`${link.pathname}${link.search}${link.hash}`);
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (event.key === "Escape" && state.videoOn === true && !dialog.open) {
    event.preventDefault();
    state.videoOn = false;
    paint({ focusKey: "play-video" });
    return;
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
  const group = target.closest("[data-keys]");
  if (!group) return;
  const current = target.closest("button, a[href]");
  if (!current || !group.contains(current)) return;
  const stops = [...group.querySelectorAll("button, a[href]")];
  const index = stops.indexOf(current);
  if (index < 0) return;
  const nextIndex = moveIndex(index, stops.length, event.key);
  if (nextIndex == null) return;
  event.preventDefault();
  const next = stops[nextIndex];
  if (group.dataset.keys === "tab") next.click();
  next.focus();
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form?.hasAttribute("data-search")) return;
  event.preventDefault();
  const q = String(new FormData(form).get("q") ?? "");
  go(`/rassen${query({ ...emptyFilters, q })}`);
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "filter-zoek") return;
  const filters = { ...state.filters, q: event.target.value, ras: "" };
  history.replaceState({}, "", `/rassen${query(filters)}`);
  readLocation();
  state.notice = "";
  paint();
});

document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.dataset.action === "english") {
    state.englishNames = store.setEnglishNames(el.checked);
    paint();
    return;
  }
  if (el.dataset.action === "compare-slot") {
    const slot = Number(el.dataset.slot);
    const next = [state.compare[0] ?? "", state.compare[1] ?? ""];
    next[slot] = el.value;
    if (next[0] && next[0] === next[1]) next[1] = "";
    state.compare = store.setCompare(next.filter((slug) => slug && sameBreed(slug)));
    state.notice = "";
    paint();
  }
});

const photoNotes = [];
let photoTimer = 0;
function queuePhoto(message) {
  photoNotes.push(message);
  window.clearTimeout(photoTimer);
  photoTimer = window.setTimeout(() => {
    const items = photoNotes.splice(0, photoNotes.length);
    const summary = photosFail(items.length, navigator.onLine);
    say(summary || items[0] || "");
  }, 60);
}

document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.broken === "1") return;
    img.dataset.broken = "1";
    const src = img.getAttribute("src") || "";
    const alt = img.alt || "";
    const frame = img.closest(".photo-frame, .photo-plain");
    const frameClass = frame ? frame.className : "";
    const host = frame || img;
    const box = document.createElement("div");
    box.className = "photo-fallback";
    const title = document.createElement("strong");
    title.textContent = shellCopy.photoTitle;
    const text = document.createElement("p");
    text.textContent = photoMessage(alt, navigator.onLine);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-line";
    button.textContent = shellCopy.photoRetry;
    button.addEventListener("click", () => {
      const fresh = document.createElement("img");
      fresh.alt = alt;
      fresh.decoding = "async";
      fresh.loading = "eager";
      const width = img.getAttribute("width");
      const height = img.getAttribute("height");
      if (width) fresh.setAttribute("width", width);
      if (height) fresh.setAttribute("height", height);
      const retrySrc = navigator.onLine && src
        ? `${src}${src.includes("?") ? "&" : "?"}opnieuw=${Date.now()}`
        : src;
      if (frameClass) {
        const wrap = document.createElement("div");
        wrap.className = frameClass;
        wrap.append(fresh);
        box.replaceWith(wrap);
      } else box.replaceWith(fresh);
      fresh.src = retrySrc;
    });
    box.append(title, text, button);
    host.replaceWith(box);
    queuePhoto(text.textContent);
  },
  true,
);

document.addEventListener("focusin", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return;
  const chip = el.closest(".chips .chip, .chips a, .chips button, .atlas .place");
  if (!chip) return;
  const scroller = chip.closest(".chips, .filters, .results, .atlas");
  if (!scroller) return;
  const reduce = state.reduceMotion;
  chip.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "auto" });
});

document.querySelector("#gids-open").addEventListener("click", () => {
  if (!state.site) return;
  dialog.showModal();
  document.querySelector("#gids-open").setAttribute("aria-expanded", "true");
  document.querySelector("#gids-sluit")?.focus();
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("close", () => {
  document.querySelector("#gids-open").setAttribute("aria-expanded", "false");
});

window.addEventListener("popstate", () => {
  readLocation();
  state.notice = "";
  paint({ scroll: location.hash ? "hash" : "top" });
});

window.addEventListener("online", syncNet);
window.addEventListener("offline", syncNet);
motionQuery.addEventListener?.("change", () => {
  state.reduceMotion = motionQuery.matches;
  if (state.site) paint({ scroll: "keep" });
});

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

async function boot() {
  state.online = navigator.onLine;
  state.reduceMotion = motionQuery.matches;
  applyTextSize(store.read().textSize);
  try {
    const response = await fetch("/content/site.json");
    if (!response.ok) throw new Error(String(response.status));
    state.site = await response.json();
    const stored = store.read();
    state.saved = stored.saved;
    state.answers = stored.answers;
    state.compare = stored.compare.filter((slug) => sameBreed(slug));
    state.englishNames = stored.englishNames;
    state.textSize = stored.textSize;
    applyTextSize(state.textSize);
    state.gaitId = state.site.gaits[0]?.id ?? "stap";
    state.bodyId = state.site.body[0]?.id ?? "oog";
    state.quizIndex = firstUnanswered(state.site.quiz, state.answers);
    dialog.innerHTML = renderGids(state.site);
  } catch {
    state.bootError = true;
  }
  readLocation();
  await refreshVideoCache();
  applyBanner();
  paint({ scroll: location.hash ? "hash" : "none" });
  if (!state.online) say(offlineBanner(state.videoCached));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type !== "video-cached") return;
      state.videoCached = true;
      applyBanner();
    });
    navigator.serviceWorker.register("/sw.js", { type: "module" }).then(() => refreshVideoCache()).catch(() => {});
  }
}

boot();
