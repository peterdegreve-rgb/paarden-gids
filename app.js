import { firstUnanswered, parseFilters, toggleCompare } from "./src/logic.js";
import { pageTitle, renderGids, renderNav, renderPage } from "./src/render.js";
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
  gaitId: "stap",
  gaitStep: 0,
  bodyId: "oog",
  videoOn: false,
  quizIndex: 0,
  notice: "",
};

const main = document.querySelector("#inhoud");
const dialog = document.querySelector("#gids");

function normalize(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

function readLocation() {
  state.path = normalize(location.pathname);
  state.filters = parseFilters(location.search);
}

function errorHtml() {
  return `<div class="empty">
    <h1>De gids kon niet openen.</h1>
    <p>Probeer opnieuw. Lukt het niet, dan stond ze nog niet op deze tablet.</p>
    <button type="button" class="btn btn-moss" data-action="retry">Opnieuw proberen</button>
  </div>`;
}

function paint({ scroll = "keep", focusKey = null } = {}) {
  const active = document.activeElement;
  const key = focusKey || active?.dataset?.focusKey || active?.id || "";
  const caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  document.title = state.site ? pageTitle(state) : "Alles over paarden";
  if (state.bootError) main.innerHTML = errorHtml();
  else if (state.site) main.innerHTML = renderPage(state);
  const nav = document.querySelector("#tabbar");
  if (nav) nav.innerHTML = state.site ? renderNav(state.path, state.saved.length) : "";
  const gidsButton = document.querySelector("#gids-open");
  if (gidsButton) gidsButton.setAttribute("aria-expanded", dialog.open ? "true" : "false");

  if (scroll === "top") {
    window.scrollTo(0, 0);
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

function handleAction(el) {
  const action = el.dataset.action;
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
    state.saved = store.toggleSaved(el.dataset.slug);
    paint();
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
    state.videoOn = navigator.onLine ? true : "offline";
    paint({ focusKey: state.videoOn === true ? "" : "play-video" });
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

function syncNet() {
  const banner = document.querySelector("#offline");
  if (banner) banner.hidden = navigator.onLine;
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

document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.broken === "1") return;
    const note = document.createElement("p");
    note.className = "photo-fallback";
    note.textContent = img.alt || "Foto";
    img.replaceWith(note);
  },
  true,
);

document.querySelector("#gids-open").addEventListener("click", () => {
  if (!state.site) return;
  dialog.showModal();
  document.querySelector("#gids-open").setAttribute("aria-expanded", "true");
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

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

async function boot() {
  try {
    const response = await fetch("/content/site.json");
    if (!response.ok) throw new Error(String(response.status));
    state.site = await response.json();
    const stored = store.read();
    state.saved = stored.saved;
    state.answers = stored.answers;
    state.compare = stored.compare.filter((slug) => sameBreed(slug));
    state.englishNames = stored.englishNames;
    state.gaitId = state.site.gaits[0]?.id ?? "stap";
    state.bodyId = state.site.body[0]?.id ?? "oog";
    state.quizIndex = firstUnanswered(state.site.quiz, state.answers);
    dialog.innerHTML = renderGids(state.site);
  } catch {
    state.bootError = true;
  }
  readLocation();
  paint({ scroll: location.hash ? "hash" : "none" });
  syncNet();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

boot();
