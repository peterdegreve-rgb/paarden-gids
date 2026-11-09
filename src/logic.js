// Shell rules only: search, filters, sort, compare, suggestions.
// Breed words stay in content/site.json.

export const EMPTY_FILTERS = {
  q: "",
  ras: "",
  streek: "",
  grootte: "",
  gebruik: "",
  kleur: "",
  karakter: "",
};

export function parseFilters(search) {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const read = (key) => params.get(key) ?? "";
  return {
    q: read("q"),
    ras: read("ras"),
    streek: read("streek"),
    grootte: read("grootte"),
    gebruik: read("gebruik"),
    kleur: read("kleur"),
    karakter: read("karakter"),
  };
}

export function filtersToQuery(filters) {
  const params = new URLSearchParams();
  for (const key of Object.keys(EMPTY_FILTERS)) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function matchesBreed(breed, filters) {
  if (filters.streek && !breed.regions.includes(filters.streek)) return false;
  if (filters.grootte && breed.size !== filters.grootte) return false;
  if (filters.gebruik && !breed.useTags.includes(filters.gebruik)) return false;
  if (filters.kleur && !breed.colorTags.includes(filters.kleur)) return false;
  if (filters.karakter && breed.tempTag !== filters.karakter) return false;
  const q = (filters.q ?? "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    breed.name,
    breed.english ?? "",
    breed.origin,
    breed.summary,
    breed.colors,
    breed.uses,
    breed.temperament,
    ...breed.regions,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function sortBreeds(breeds, regionOrder) {
  const rank = (breed) => {
    const indexes = breed.regions.map((region) => regionOrder.indexOf(region));
    return Math.min(...indexes);
  };
  return [...breeds].sort((a, b) => {
    const byRegion = rank(a) - rank(b);
    if (byRegion !== 0) return byRegion;
    return a.name.localeCompare(b.name, "nl");
  });
}

export function filterBreeds(breeds, filters, regionOrder) {
  return sortBreeds(
    breeds.filter((breed) => matchesBreed(breed, filters)),
    regionOrder,
  );
}

export function relatedBreeds(breed, breeds, limit = 3) {
  return breeds
    .filter((other) => other.slug !== breed.slug)
    .map((other) => ({
      other,
      score:
        other.regions.filter((region) => breed.regions.includes(region)).length * 3 +
        (other.size === breed.size ? 2 : 0) +
        other.useTags.filter((tag) => breed.useTags.includes(tag)).length,
    }))
    .sort((a, b) => b.score - a.score || a.other.name.localeCompare(b.other.name, "nl"))
    .slice(0, limit)
    .map((item) => item.other);
}

export function toggleCompare(current, slug, max = 2) {
  const list = current.filter(Boolean);
  if (list.includes(slug)) return { list: list.filter((item) => item !== slug), rejected: false };
  if (list.length >= max) return { list, rejected: true };
  return { list: [...list, slug], rejected: false };
}

export function normalizeCompare(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").slice(0, 2);
  if (value && typeof value === "object" && Array.isArray(value.list)) {
    return value.list.filter((item) => typeof item === "string").slice(0, 2);
  }
  return [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = old;
    }
  }
  return row[b.length];
}

export function breedSuggestions(breeds, query) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const scored = [];
  for (const breed of breeds) {
    const candidates = [breed.name, breed.english ?? "", breed.name.split(" ")[0], (breed.english ?? "").split(" ")[0]]
      .map((item) => item.toLowerCase())
      .filter(Boolean);
    const distance = Math.min(...candidates.map((item) => levenshtein(q, item)));
    if (distance > 0 && distance <= 2) scored.push({ breed, distance });
  }
  scored.sort((a, b) => a.distance - b.distance || a.breed.name.localeCompare(b.breed.name, "nl"));
  const seen = new Set();
  const out = [];
  for (const item of scored) {
    if (seen.has(item.breed.slug)) continue;
    seen.add(item.breed.slug);
    out.push(item.breed);
    if (out.length === 3) break;
  }
  return out;
}

export function searchGuide(site, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  const add = (hit) => {
    if (hit.hay.toLowerCase().includes(q)) hits.push(hit);
  };
  for (const item of site.learn) {
    add({ href: item.to, title: item.title, text: item.text, hay: `${item.title} ${item.text}` });
  }
  for (const item of site.facts) {
    add({ href: `/weetjes#${item.id}`, title: item.title, text: item.text, hay: `${item.title} ${item.text}` });
  }
  for (const item of site.glossary) {
    add({ href: `/woorden#${slugId(item.term)}`, title: item.term, text: item.text, hay: `${item.term} ${item.text}` });
  }
  for (const item of site.legends.items) {
    add({ href: `/legendes#${item.id}`, title: item.title, text: item.origin, hay: `${item.title} ${item.origin}` });
  }
  for (const item of site.famous) {
    add({ href: `/beroemd#${item.id}`, title: item.name, text: item.place, hay: `${item.name} ${item.place} ${item.when}` });
  }
  for (const item of site.jobs) {
    add({ href: `/beroepen#${item.id}`, title: item.title, text: item.place, hay: `${item.title} ${item.place}` });
  }
  for (const item of site.stories) {
    add({ href: `/verhalen#${item.id}`, title: item.title, text: item.place, hay: `${item.title} ${item.place}` });
  }
  for (const item of site.gaits) {
    add({ href: "/gangen", title: item.title, text: item.beat, hay: `${item.title} ${item.beat}` });
  }
  for (const item of site.body) {
    add({ href: "/lichaam", title: item.name, text: "", hay: item.name });
  }
  const seen = new Set();
  const unique = [];
  for (const hit of hits) {
    const key = `${hit.href}|${hit.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
    if (unique.length === 6) break;
  }
  return unique;
}

export function slugId(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function firstUnanswered(quiz, answers) {
  const index = quiz.findIndex((item) => !answers[item.id]);
  return index === -1 ? quiz.length : index;
}
