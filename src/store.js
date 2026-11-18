// Same localStorage shape as the previous gids, so a list already on the tablet stays.
// { state: { saved: string[], answers: Record<string, string> }, version: 0 }
// Text size and the English-name switch live in a separate key.

import { normalizeTextSize } from "./shell.js";

export const STORE_KEY = "paarden-gids";
export const COMPARE_KEY = "paarden-gids-vergelijk";
export const PREF_KEY = "paarden-gids-voorkeur";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

export function createStore(storage = memoryStorage()) {
  function readRaw(key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readGuide() {
    const parsed = readRaw(STORE_KEY);
    const state = parsed?.state ?? {};
    return {
      saved: Array.isArray(state.saved) ? state.saved.filter((item) => typeof item === "string") : [],
      answers: state.answers && typeof state.answers === "object" ? { ...state.answers } : {},
    };
  }

  function writeGuide(next) {
    storage.setItem(STORE_KEY, JSON.stringify({ state: { saved: next.saved, answers: next.answers }, version: 0 }));
  }

  function readPref() {
    const pref = readRaw(PREF_KEY) ?? {};
    return {
      englishNames: Boolean(pref.englishNames),
      textSize: normalizeTextSize(pref.textSize),
    };
  }

  function writePref(pref) {
    storage.setItem(
      PREF_KEY,
      JSON.stringify({
        englishNames: Boolean(pref.englishNames),
        textSize: normalizeTextSize(pref.textSize),
      }),
    );
  }

  return {
    read() {
      const guide = readGuide();
      const compare = readRaw(COMPARE_KEY);
      const pref = readPref();
      return {
        saved: guide.saved,
        answers: guide.answers,
        compare: Array.isArray(compare) ? compare.filter((item) => typeof item === "string").slice(0, 2) : [],
        englishNames: pref.englishNames,
        textSize: pref.textSize,
      };
    },
    toggleSaved(slug) {
      const guide = readGuide();
      const saved = guide.saved.includes(slug) ? guide.saved.filter((item) => item !== slug) : [...guide.saved, slug];
      writeGuide({ saved, answers: guide.answers });
      return saved;
    },
    setAnswer(id, choice) {
      const guide = readGuide();
      writeGuide({ saved: guide.saved, answers: { ...guide.answers, [id]: choice } });
      return readGuide().answers;
    },
    resetAnswers() {
      const guide = readGuide();
      writeGuide({ saved: guide.saved, answers: {} });
      return {};
    },
    setCompare(slugs) {
      const compare = slugs.filter((item) => typeof item === "string").slice(0, 2);
      storage.setItem(COMPARE_KEY, JSON.stringify(compare));
      return compare;
    },
    setEnglishNames(englishNames) {
      const pref = readPref();
      writePref({ ...pref, englishNames: Boolean(englishNames) });
      return Boolean(englishNames);
    },
    setTextSize(size) {
      const pref = readPref();
      const textSize = normalizeTextSize(size);
      writePref({ ...pref, textSize });
      return textSize;
    },
  };
}
