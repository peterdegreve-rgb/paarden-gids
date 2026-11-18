import { copy } from "./copy.js";
import {
  breedSuggestions,
  filterBreeds,
  filtersToQuery,
  relatedBreeds,
  searchGuide,
  slugId,
} from "./logic.js";
import {
  bootMessage,
  compareLabel,
  rasWord,
  saveLabel,
  shellCopy,
} from "./shell.js";

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paras(list) {
  return (list ?? []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
}

function header(kicker, title, lede) {
  return `<header class="page-head">
    ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ""}
    <h1>${esc(title)}</h1>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ""}
  </header>`;
}

function photo(src, alt, { eager = false, frame = true } = {}) {
  const loading = eager ? "eager" : "lazy";
  return `<div class="${frame ? "photo-frame" : "photo-plain"}">
    <img src="${esc(src)}" alt="${esc(alt)}" loading="${loading}" decoding="async">
  </div>`;
}

function saveButton(breed, saved) {
  const on = saved.includes(breed.slug);
  return `<button type="button" class="btn ${on ? "btn-moss" : "btn-line"}" data-action="save" data-slug="${esc(breed.slug)}" data-focus-key="save-${esc(breed.slug)}" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(saveLabel(breed.name, on))}">
    <span aria-hidden="true">${on ? "★" : "☆"}</span> ${on ? esc(copy.rassen.saved) : esc(copy.rassen.save)}
  </button>`;
}

function compareButton(breed, compare) {
  const on = compare.includes(breed.slug);
  return `<button type="button" class="btn ${on ? "btn-moss" : "btn-line"}" data-action="compare" data-slug="${esc(breed.slug)}" data-focus-key="cmp-${esc(breed.slug)}" aria-pressed="${on ? "true" : "false"}" aria-label="${esc(compareLabel(breed.name, on))}">
    ${on ? "Gekozen" : "Vergelijk"}
  </button>`;
}

function breedCard(breed, state, { actions = true } = {}) {
  const href = `/rassen${filtersToQuery({ ...state.filters, ras: breed.slug })}`;
  const english = state.englishNames && breed.english ? `<p class="en" lang="en">${esc(breed.english)}</p>` : "";
  const nameId = `naam-${breed.slug}`;
  const sizeId = `maat-${breed.slug}`;
  return `<article class="card">
    <a class="card-link" href="${esc(href)}" aria-labelledby="${esc(nameId)} ${esc(sizeId)}">
      ${photo(`/horses/${breed.slug}.jpg`, breed.imageAlt)}
      <div class="card-body">
        <div class="card-title">
          <h2 id="${esc(nameId)}">${esc(breed.name)}</h2>
          <span class="size" id="${esc(sizeId)}">${esc(state.site.sizeLabels[breed.size] ?? breed.size)}</span>
        </div>
        ${english}
        <p class="origin">${esc(breed.origin)}</p>
        <p class="summary">${esc(breed.summary)}</p>
      </div>
    </a>
    ${actions ? `<div class="card-actions">${saveButton(breed, state.saved)}${compareButton(breed, state.compare)}</div>` : ""}
  </article>`;
}

function listHref(filters) {
  return `/rassen${filtersToQuery({ ...filters, ras: "" })}`;
}

function rassenPage(state) {
  const { site, filters } = state;
  const breed = filters.ras ? site.breeds.find((item) => item.slug === filters.ras) : null;
  if (filters.ras) {
    if (!breed) {
      return `${header("", copy.rassen.missingTitle, copy.rassen.missingLede)}
        <div class="empty">
          <p>${esc(shellCopy.missingBreedNext)}</p>
          <p><a class="text-link" href="/rassen">${esc(copy.rassen.backAll)}</a></p>
        </div>`;
    }
    return detailPage(state, breed);
  }

  const found = filterBreeds(site.breeds, filters, site.regionOrder);
  const active = ["streek", "grootte", "gebruik", "kleur", "karakter"].some((key) => filters[key]) || filters.q;
  const groups = copy.rassen.groups
    .map(([key, label]) => {
      const options = site.filters[key]
        .map((option) => {
          const on = filters[key] === option.id;
          return `<button type="button" class="chip ${on ? "chip-on" : ""}" data-action="filter" data-key="${esc(key)}" data-value="${esc(option.id)}" data-focus-key="f-${esc(key)}-${esc(option.id)}" aria-pressed="${on ? "true" : "false"}">${esc(option.label)}</button>`;
        })
        .join("");
      return `<div class="filter-block"><p id="lab-${esc(key)}">${esc(label)}</p><div class="chips" role="group" aria-labelledby="lab-${esc(key)}" data-keys="move">${options}</div></div>`;
    })
    .join("");

  const suggestions = found.length === 0 ? breedSuggestions(site.breeds, filters.q) : [];
  const guide = filters.q.trim().length >= 2 ? searchGuide(site, filters.q) : [];
  const results = found.length
    ? `<ul class="cards">${found.map((item) => `<li>${breedCard(item, state)}</li>`).join("")}</ul>`
    : `<div class="empty"><p>${esc(copy.rassen.empty)}</p>
        ${suggestions.length ? `<p>Bedoelde je ${suggestions.map((item) => `<a class="text-link" href="/rassen?ras=${esc(item.slug)}">${esc(item.name)}</a>`).join(", ")}?</p>` : ""}
        <p>${esc(shellCopy.emptyRassenNext)}</p>
      </div>`;
  const guideBlock = guide.length
    ? `<section class="guide-hits"><h2>In de gids</h2><ul>${guide
        .map(
          (hit) => `<li><a href="${esc(hit.href)}"><span>${esc(hit.title)}</span>${hit.text ? `<small>${esc(hit.text)}</small>` : ""}</a></li>`,
        )
        .join("")}</ul></section>`
    : "";

  return `<div class="rassen-page">${header(copy.rassen.kicker, copy.rassen.title, copy.rassen.lede)}
    <div class="rassen-layout">
      <div class="filters">
        <div role="search">
          <label class="sr-only" for="filter-zoek">${esc(copy.rassen.searchLabel)}</label>
          <input id="filter-zoek" type="search" enterkeyhint="search" autocomplete="off" value="${esc(filters.q)}" placeholder="${esc(copy.rassen.searchPlaceholder)}" aria-controls="ras-lijst" aria-describedby="ras-count">
        </div>
        ${groups}
        <label class="switch">
          <input id="english-toggle" data-focus-key="english-toggle" type="checkbox" data-action="english" ${state.englishNames ? "checked" : ""}>
          <span>Toon de Engelse naam</span>
        </label>
      </div>
      <div class="results${found.length ? "" : " results-empty"}" id="ras-lijst">
        <div class="count-row">
          <p id="ras-count">${found.length} ${rasWord(found.length)}</p>
          ${active ? `<button type="button" class="btn btn-quiet" data-action="clear-filters" data-focus-key="clear-filters">${esc(copy.rassen.clear)}</button>` : ""}
        </div>
        ${state.notice ? `<p class="notice" role="status">${esc(state.notice)}</p>` : ""}
        ${results}
        ${guideBlock}
        <aside class="open-q"><p><strong>Nog te vragen aan Fien.</strong> De Engelse naam van een ras staat in de gids. De uitleg is Nederlands. Een Engelse tekst is er nog niet.</p></aside>
      </div>
    </div></div>`;
}

function detailPage(state, breed) {
  const english = breed.english ? `<p class="en" lang="en">${esc(breed.english)}</p>` : "";
  const stats = copy.rassen.fields
    .map(
      ([label, key]) => `<div><dt>${esc(label)}</dt><dd>${esc(breed[key])}</dd></div>`,
    )
    .join("");
  const related = relatedBreeds(breed, state.site.breeds);
  return `<article class="breed-sheet">
    <p><a class="text-link back" href="${esc(listHref(state.filters))}">${esc(copy.rassen.backList)}</a></p>
    <div class="title-row">
      <div>
        <p class="kicker">${esc(breed.origin)}</p>
        <h1>${esc(breed.name)}</h1>
        ${english}
      </div>
      <div class="card-actions">${saveButton(breed, state.saved)}${compareButton(breed, state.compare)}</div>
    </div>
    ${state.notice ? `<p class="notice" role="status">${esc(state.notice)}</p>` : ""}
    <figure class="hero-photo">${photo(`/horses/${breed.slug}.jpg`, breed.imageAlt, { eager: true })}</figure>
    <dl class="stats">${stats}</dl>
    <section class="prose"><h2>${esc(copy.rassen.shortTitle)}</h2>${paras(breed.paragraphs)}</section>
    <section><h2>${esc(copy.rassen.storiesTitle)}</h2><ul class="notes">${breed.anecdotes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>
    <section class="prose"><h2>${esc(copy.rassen.factsTitle)}</h2><ul class="fact-list">${breed.facts.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>
    <p class="disclaimer">${esc(copy.rassen.disclaimer)}</p>
    <section class="also"><h2>${esc(copy.rassen.also)}</h2><ul class="cards">${related.map((item) => `<li>${breedCard(item, { ...state, filters: { ...state.filters, q: "", streek: "", grootte: "", gebruik: "", kleur: "", karakter: "" } })}</li>`).join("")}</ul></section>
  </article>`;
}

function homePage(state) {
  const { site } = state;
  const neighbours = site.breeds.filter((breed) => breed.regions.some((region) => region !== "Wereld")).length;
  const featured = site.breeds.find((breed) => breed.slug === "belgisch-trekpaard") ?? site.breeds[0];
  const remembered = ["zee", "eenhoorn-tand", "hans"].flatMap((id) => {
    const fact = site.facts.find((item) => item.id === id);
    return fact ? [fact] : [];
  });
  const canPlay = state.online !== false || state.videoCached === true;
  const offlineVideo = !canPlay || state.videoOn === "offline";
  const video = state.videoOn === true && canPlay
    ? `<video class="hero-video" data-focus-key="hero-video" tabindex="0" poster="/horses/weide.jpg" controls playsinline preload="metadata" width="1280" height="720" ${state.reduceMotion ? "" : "autoplay"} aria-label="${esc(shellCopy.videoName)}">
        <source src="/horses/weide.mp4" type="video/mp4">
      </video>
      <button type="button" class="btn btn-line video-close" data-action="close-video">${esc(shellCopy.closeVideo)}</button>`
    : `<button type="button" class="video-btn" data-action="play-video" data-focus-key="play-video" aria-label="${esc(shellCopy.videoLabel)}" ${offlineVideo ? 'aria-describedby="video-offline"' : ""}>
        ${photo("/horses/weide.jpg", copy.home.videoAlt, { eager: true, frame: false })}
        <span>${esc(copy.home.videoButton)}</span>
      </button>
      ${offlineVideo ? `<p class="notice" id="video-offline">${esc(shellCopy.videoOffline)}</p>` : ""}`;

  return `<div class="home-hero">
      <div>
        ${header(copy.home.kicker, copy.home.title, copy.home.lede)}
        <form class="search-row" data-search action="/rassen" role="search">
          <label class="sr-only" for="zoek">${esc(copy.home.searchLabel)}</label>
          <input id="zoek" name="q" type="search" enterkeyhint="search" placeholder="${esc(copy.home.searchPlaceholder)}">
          <button class="btn btn-moss" type="submit">${esc(copy.home.searchButton)}</button>
        </form>
        <ul class="tiles">
          <li><a href="/rassen"><span>Rassen</span><small>Kijk en vergelijk</small></a></li>
          <li><a href="/kaart"><span>Kaart</span><small>Kies een streek</small></a></li>
          <li><a href="/vergelijk"><span>Vergelijk</span><small>Twee rassen naast elkaar</small></a></li>
          <li><a href="/favorieten"><span>Bewaard</span><small>${state.saved.length ? `${state.saved.length} op dit toestel` : "Je lijst"}</small></a></li>
        </ul>
      </div>
      <figure class="hero-photo">
        ${video}
        <figcaption>${esc(copy.home.videoCaption)}</figcaption>
      </figure>
    </div>
    <p class="prose lead-gap">${esc(copy.home.count(site.breeds.length, neighbours))}</p>
    <a class="feature" href="/beroepen#garnaal">
      ${photo("/horses/garnaal.jpg", copy.home.garnaalAlt, { frame: false })}
      <span><small>${esc(copy.home.garnaalKicker)}</small><strong>${esc(copy.home.garnaalTitle)}</strong><em>${esc(copy.home.garnaalText)}</em></span>
    </a>
    <a class="feature feature-flip" href="/legendes#pegasus">
      <span><small>${esc(copy.home.pegasusKicker)}</small><strong>${esc(copy.home.pegasusTitle)}</strong><em>${esc(copy.home.pegasusText)}</em></span>
      ${photo("/horses/pegasus.jpg", copy.home.pegasusAlt, { frame: false })}
    </a>
    <ul class="learn-grid">${site.learn.slice(0, 6).map((item) => `<li><a href="${esc(item.to)}"><span>${esc(item.title)}</span><small>${esc(item.text)}</small></a></li>`).join("")}</ul>
    <section>
      <h2>${esc(copy.home.featuredTitle)}</h2>
      <p class="lede">${esc(copy.home.featuredLede)}</p>
      <div class="featured-one">${breedCard(featured, { ...state, filters: emptyFilters() })}</div>
    </section>
    <section>
      <h2>${esc(copy.home.rememberTitle)}</h2>
      <ul class="fact-grid">${remembered.map((fact) => `<li><h3>${esc(fact.title)}</h3><p>${esc(fact.text)}</p></li>`).join("")}</ul>
      <p><a class="text-link" href="/weetjes">${esc(copy.home.allFacts)}</a></p>
    </section>
    <p class="tablet-tip">Tip voor op de tablet: zet de gids op het startscherm. Dan opent ze als een app, ook even zonder internet.</p>`;
}

function emptyFilters() {
  return { q: "", ras: "", streek: "", grootte: "", gebruik: "", kleur: "", karakter: "" };
}

function mapPage(state) {
  const order = state.site.regionOrder;
  const selected = state.filters.streek;
  const buttons = order
    .map((region) => {
      const count = state.site.breeds.filter((breed) => breed.regions.includes(region)).length;
      const on = selected === region;
      return `<button type="button" class="place place-${slugId(region)} ${on ? "place-on" : ""}" data-action="map" data-value="${esc(region)}" data-focus-key="map-${esc(slugId(region))}" aria-pressed="${on ? "true" : "false"}">
        <span>${esc(region)}</span><small><span class="sr-only">, </span>${count}<span class="sr-only"> ${rasWord(count)}</span></small>
      </button>`;
    })
    .join("");
  const found = selected ? state.site.breeds.filter((breed) => breed.regions.includes(selected)) : [];
  const sorted = selected ? filterBreeds(found, emptyFilters(), state.site.regionOrder) : [];
  const list = selected
    ? sorted.length
      ? `<ul class="cards">${sorted.map((breed) => `<li>${breedCard(breed, state)}</li>`).join("")}</ul>`
      : `<div class="empty"><p>${esc(shellCopy.emptyRegion)}</p></div>`
    : `<div class="empty"><p>${esc(shellCopy.emptyMap)}</p><p>${esc(shellCopy.emptyMapNext)}</p></div>`;
  return `<div class="map-page">${header("Kaart", "Kies een streek", "Tik een streek. Je ziet de rassen die de gids daarbij zet.")}
    <aside class="open-q"><p><strong>Nog te vragen aan Fien.</strong> Dit is een keuzescherm van de streken die al in de gids staan. Een wereldkaart met een stip per ras is er nog niet.</p></aside>
    <div class="map-layout">
      <div class="atlas" role="group" aria-label="Streken" data-keys="move">${buttons}</div>
      <div class="results">${list}</div>
    </div></div>`;
}

function landOf(breed) {
  const lands = breed.regions.filter((region) => region !== "Wereld");
  return lands.join(", ") || breed.origin;
}

function comparePage(state) {
  const breeds = filterBreeds(state.site.breeds, emptyFilters(), state.site.regionOrder);
  const chosen = state.compare
    .map((slug) => state.site.breeds.find((breed) => breed.slug === slug))
    .filter(Boolean)
    .slice(0, 2);
  const options = (slot) => {
    const current = chosen[slot]?.slug ?? "";
    const items = breeds
      .map((breed) => `<option value="${esc(breed.slug)}" ${breed.slug === current ? "selected" : ""}>${esc(breed.name)}</option>`)
      .join("");
    return `<label class="slot">Ras ${slot + 1}<span class="sr-only"> van twee</span>
      <select data-action="compare-slot" data-slot="${slot}" data-focus-key="slot-${slot}">
        <option value="" ${current ? "" : "selected"}>Kies een ras</option>
        ${items}
      </select>
    </label>`;
  };
  let body;
  if (chosen.length < 2) {
    body = `<div class="empty"><p>${esc(chosen.length === 1 ? shellCopy.emptyCompareOne : shellCopy.emptyCompareNone)}</p><p>${esc(shellCopy.emptyCompareNext)}</p><p><a class="text-link" href="/rassen">Naar de rassen</a></p></div>`;
  } else {
    const rows = [
      ["Foto", (breed) => photo(`/horses/${breed.slug}.jpg`, breed.imageAlt)],
      ["Naam", (breed) => `<a class="text-link" href="/rassen?ras=${esc(breed.slug)}">${esc(breed.name)}</a>`],
      ["Engelse naam", (breed) => (breed.english ? `<span lang="en">${esc(breed.english)}</span>` : "—")],
      ["Herkomst", (breed) => esc(breed.origin)],
      ["Streek", (breed) => esc(breed.regions.join(", "))],
      ["Schofthoogte", (breed) => esc(breed.height)],
      ["Gewicht", (breed) => esc(breed.weight)],
      ["Kleur", (breed) => esc(breed.colors)],
      ["Karakter", (breed) => esc(breed.temperament)],
      ["Gebruik", (breed) => esc(breed.uses)],
      ["Grootte", (breed) => esc(state.site.sizeLabels[breed.size] ?? breed.size)],
      ["Behang", (breed) => esc(breed.feather ?? copy.heavy.emptyFeather)],
    ];
    body = `<div class="cmp-scroll" tabindex="0" role="region" aria-label="${esc(chosen[0].name)} en ${esc(chosen[1].name)}"><table class="cmp">
      <caption class="sr-only print-show">${esc(chosen[0].name)} en ${esc(chosen[1].name)}</caption>
      <thead><tr><th scope="col"><span class="sr-only print-inline">Onderwerp</span></th>${chosen.map((breed) => `<th scope="col">${esc(breed.name)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map(
          ([label, cell]) => `<tr><th scope="row">${esc(label)}</th>${chosen.map((breed) => `<td>${cell(breed)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>
    </table></div>`;
  }
  const heavy = state.site.breeds.filter((breed) => breed.size === "zwaar");
  const heavyTable = `<section class="heavy">
      <h2>${esc(copy.heavy.title)}</h2>
      <p class="lede">${esc(copy.heavy.lede)}</p>
      <div class="cmp-scroll" tabindex="0" role="region" aria-label="${esc(copy.heavy.title)}"><table class="cmp">
        <caption class="sr-only">${esc(copy.heavy.title)}</caption>
        <thead><tr>${copy.heavy.columns.map((column) => `<th scope="col">${esc(column)}</th>`).join("")}</tr></thead>
        <tbody>${heavy
          .map(
            (breed) => `<tr>
              <th scope="row"><a class="text-link" href="/rassen?ras=${esc(breed.slug)}">${esc(breed.name)}</a></th>
              <td>${esc(landOf(breed))}</td>
              <td>${esc(breed.height)}</td>
              <td>${esc(breed.weight)}</td>
              <td>${esc(breed.feather ?? copy.heavy.emptyFeather)}</td>
            </tr>`,
          )
          .join("")}</tbody>
      </table></div>
    </section>`;
  return `${header("Vergelijk", "Twee rassen naast elkaar", "Kies twee rassen. Je ziet de feiten naast elkaar. De gids zegt niet welk paard beter is.")}
    <aside class="open-q"><p><strong>Nog te vragen aan Noa.</strong> Nu passen er twee rassen naast elkaar. Wil je er soms drie?</p></aside>
    ${state.notice ? `<p class="notice" role="status">${esc(state.notice)}</p>` : ""}
    <div class="slots">${options(0)}${options(1)}</div>
    ${body}
    ${heavyTable}`;
}

function savedPage(state) {
  const breeds = state.saved
    .map((slug) => state.site.breeds.find((breed) => breed.slug === slug))
    .filter(Boolean);
  const body = breeds.length
    ? `<ul class="cards">${breeds.map((breed) => `<li>${breedCard(breed, state)}</li>`).join("")}</ul>`
    : `<div class="empty"><p>${esc(copy.savedPage.empty)}</p><p>${esc(shellCopy.emptySavedNext)}</p><p><a class="text-link" href="/rassen">${esc(copy.savedPage.toBreeds)}</a></p></div>`;
  return `${header(copy.savedPage.kicker, copy.savedPage.title, copy.savedPage.lede)}${body}`;
}

function learnPage(state) {
  return `${header(copy.learn.kicker, copy.learn.title, copy.learn.lede)}
    <ul class="learn-grid">${state.site.learn.map((item) => `<li><a href="${esc(item.to)}"><span>${esc(item.title)}</span><small>${esc(item.text)}</small></a></li>`).join("")}</ul>`;
}

function jobsPage(state) {
  const items = state.site.jobs
    .map(
      (job) => `<li id="${esc(job.id)}">
        <p class="origin">${esc(job.place)}</p>
        <h2>${esc(job.title)}</h2>
        ${job.image ? `<figure class="hero-photo">${photo(job.image, job.imageAlt ?? job.title)}</figure>` : ""}
        <div class="prose">${paras(job.paragraphs)}</div>
        <p class="anecdote">${esc(job.anecdote)}</p>
        <p class="remember">${esc(job.remember)}</p>
      </li>`,
    )
    .join("");
  return `${header(copy.jobs.kicker, copy.jobs.title, copy.jobs.lede)}
    <ul class="stories">${items}</ul>
    <p class="disclaimer">${esc(copy.jobs.footerBefore)} <a class="text-link" href="/rassen?q=trek">${esc(copy.jobs.footerLink)}</a>.</p>`;
}

function legendsPage(state) {
  const kinds = state.site.legends.kinds;
  const nav = `<nav class="chips" aria-label="Legendes" data-keys="move">${state.site.legends.items
    .map((item) => `<a class="chip" href="#${esc(item.id)}">${esc(item.title)}</a>`)
    .join("")}</nav>`;
  const items = state.site.legends.items
    .map(
      (item) => `<li id="${esc(item.id)}">
        <p class="origin">${esc(kinds[item.kind] ?? item.kind)} · ${esc(item.origin)}</p>
        <h2>${esc(item.title)}</h2>
        ${item.image ? `<figure class="hero-photo">${photo(item.image, item.imageAlt ?? item.title)}</figure>` : ""}
        <div class="prose">${paras(item.paragraphs)}</div>
        <div class="study"><h3>${esc(copy.legends.study)}</h3><p>${esc(item.study)}</p></div>
        <p class="remember">${esc(item.line)}</p>
      </li>`,
    )
    .join("");
  return `${header(copy.legends.kicker, copy.legends.title, copy.legends.lede)}
    <p class="callout">${esc(copy.legends.notice)}</p>
    ${nav}
    <ul class="stories">${items}</ul>
    <p class="disclaimer">${esc(copy.legends.footerBefore)} <a class="text-link" href="/beroemd">${esc(copy.legends.footerFamous)}</a>. ${esc(copy.legends.footerMid)} <a class="text-link" href="/verhalen">${esc(copy.legends.footerStories)}</a>.</p>`;
}

function famousPage(state) {
  const nav = `<nav class="chips" aria-label="Beroemde paarden" data-keys="move">${state.site.famous
    .map((item) => `<a class="chip" href="#${esc(item.id)}">${esc(item.name)}</a>`)
    .join("")}</nav>`;
  const items = state.site.famous
    .map(
      (item) => `<section id="${esc(item.id)}">
        <p class="origin">${esc(item.when)} · ${esc(item.place)}</p>
        <h2>${esc(item.name)}</h2>
        <div class="prose">${paras(item.paragraphs)}</div>
        <p class="anecdote">${esc(item.anecdote)}</p>
      </section>`,
    )
    .join("");
  return `${header(copy.famous.kicker, copy.famous.title, copy.famous.lede)}
    ${nav}
    ${items}
    <p class="disclaimer">${esc(copy.famous.footerBefore)} <a class="text-link" href="/legendes">${esc(copy.famous.footerLink)}</a>. ${esc(copy.famous.footerAfter)}</p>`;
}

function storiesPage(state) {
  const items = state.site.stories
    .map(
      (item) => `<section id="${esc(item.id)}">
        <p class="origin">${esc(item.place)}</p>
        <h2>${esc(item.title)}</h2>
        <div class="prose">${paras(item.paragraphs)}</div>
      </section>`,
    )
    .join("");
  return `${header(copy.stories.kicker, copy.stories.title, copy.stories.lede)}
    ${items}
    <p class="disclaimer">${esc(copy.stories.footerBefore)} <a class="text-link" href="/legendes">${esc(copy.stories.footerLegends)}</a>. ${esc(copy.stories.footerMid)} <a class="text-link" href="/beroemd">${esc(copy.stories.footerFamous)}</a>.</p>`;
}

function chapterPage(kicker, title, lede, sections) {
  return `${header(kicker, title, lede)}
    ${sections.map((section) => `<section class="chapter"><h2>${esc(section.title)}</h2><div class="prose">${paras(section.paragraphs)}</div></section>`).join("")}`;
}

function gaitsPage(state) {
  const gait = state.site.gaits.find((item) => item.id === state.gaitId) ?? state.site.gaits[0];
  const step = gait.steps[state.gaitStep % gait.steps.length];
  const down = new Set(step.hooves);
  const order = ["LV", "RV", "LA", "RA"];
  const pads = order
    .map((id) => {
      const hoof = state.site.hooves.find((item) => item.id === id);
      const on = down.has(id);
      return `<span class="hoof ${on ? "hoof-on" : ""}">${esc(hoof?.label ?? id)}</span>`;
    })
    .join("");
  const tabs = state.site.gaits
    .map((item) => {
      const on = item.id === gait.id;
      return `<button type="button" class="chip ${on ? "chip-on" : ""}" role="tab" id="gait-tab-${esc(item.id)}" aria-controls="gang-pane" tabindex="${on ? "0" : "-1"}" data-action="gait" data-value="${esc(item.id)}" data-focus-key="gait-${esc(item.id)}" aria-selected="${on ? "true" : "false"}">${esc(item.title)}</button>`;
    })
    .join("");
  return `<div class="gait-page">${header(copy.gaits.kicker, copy.gaits.title, copy.gaits.lede)}
    <div class="chips" role="tablist" aria-label="Gangen" data-keys="tab">${tabs}</div>
    <div class="gait-layout screen-only">
      <div class="gait-board">
        <p class="origin">${esc(gait.beat)}</p>
        <p class="hear">${esc(gait.hear)}</p>
        <p>${esc(copy.gaits.facing)}</p>
        <div class="hooves" aria-hidden="true">${pads}</div>
        <p class="disclaimer">${esc(copy.gaits.order)}</p>
        <p id="gang-stap">${esc(step.label)}</p>
        <button type="button" class="btn btn-moss" data-action="next-step" data-focus-key="next-step">${esc(copy.gaits.next)}</button>
      </div>
      <div class="prose gait-copy" id="gang-pane" role="tabpanel" aria-labelledby="gait-tab-${esc(gait.id)}"><h2>${esc(gait.title)}</h2>${paras(gait.paragraphs)}</div>
    </div>
    <div class="print-only">${state.site.gaits
      .map(
        (item) => `<section class="chapter"><h2>${esc(item.title)}</h2><p class="origin">${esc(item.beat)}</p><p class="hear">${esc(item.hear)}</p><div class="prose">${paras(item.paragraphs)}</div></section>`,
      )
      .join("")}</div>
    </div>`;
}

function bodyPage(state) {
  const part = state.site.body.find((item) => item.id === state.bodyId) ?? state.site.body[0];
  const points = state.site.body.filter((item) => item.x != null && item.y != null);
  const dots = points
    .map((item) => {
      const on = item.id === part.id;
      return `<button type="button" class="hotspot ${on ? "hotspot-on" : ""}" style="left:${Number(item.x)}%;top:${Number(item.y)}%" data-action="body" data-value="${esc(item.id)}" data-focus-key="body-${esc(item.id)}" aria-label="${esc(item.name)}" aria-pressed="${on ? "true" : "false"}"></button>`;
    })
    .join("");
  const chips = state.site.body
    .map((item) => {
      const on = item.id === part.id;
      return `<button type="button" class="chip ${on ? "chip-on" : ""}" data-action="body" data-value="${esc(item.id)}" data-focus-key="body-${esc(item.id)}" aria-pressed="${on ? "true" : "false"}">${esc(item.name)}</button>`;
    })
    .join("");
  const hoof = copy.body.hoof
    .map(([term, text]) => `<div><dt>${esc(term)}</dt><dd>${esc(text)}</dd></div>`)
    .join("");
  return `${header(copy.body.kicker, copy.body.title, copy.body.lede)}
    <div class="body-map" role="group" aria-label="Stippen op het paard" data-keys="move">
      <img src="/horses/lichaam.jpg" alt="${esc(copy.body.alt)}" width="1200" height="800">
      ${dots}
    </div>
    <div class="chips screen-only" role="group" aria-label="Lichaamsdelen" data-keys="move">${chips}</div>
    <section class="prose screen-only" id="lichaam-tekst"><h2>${esc(part.name)}</h2>${paras(part.paragraphs)}</section>
    <div class="print-only">${state.site.body
      .map(
        (item) => `<section class="chapter"><h2>${esc(item.name)}</h2><div class="prose">${paras(item.paragraphs)}</div></section>`,
      )
      .join("")}</div>
    <figure class="diagram">
      <svg viewBox="0 0 480 240" role="img" aria-labelledby="zicht-titel">
        <title id="zicht-titel">${esc(copy.body.diagramTitle)}</title>
        <circle cx="230" cy="120" r="100" fill="var(--moss)" opacity="0.15"></circle>
        <path d="M40 120 L120 92 L120 148 Z" fill="var(--brass)" opacity="0.55"></path>
        <path d="M430 120 L360 98 L360 142 Z" fill="var(--brass)" opacity="0.55"></path>
        <ellipse cx="250" cy="124" rx="78" ry="34" fill="var(--ink)"></ellipse>
        <ellipse cx="168" cy="112" rx="32" ry="18" fill="var(--ink)"></ellipse>
      </svg>
      <figcaption>${esc(copy.body.diagramCaption)}</figcaption>
    </figure>
    <section><h2>${esc(copy.body.hoofTitle)}</h2><dl class="stats">${hoof}</dl></section>`;
}

function factsPage(state) {
  const items = state.site.facts
    .map((fact) => `<li id="${esc(fact.id)}"><h2>${esc(fact.title)}</h2><p>${esc(fact.text)}</p></li>`)
    .join("");
  return `${header(copy.facts.kicker, copy.facts.title, copy.facts.lede)}<ul class="fact-grid">${items}</ul>`;
}

function glossaryPage(state) {
  const items = [...state.site.glossary]
    .sort((a, b) => a.term.localeCompare(b.term, "nl"))
    .map((item) => `<div id="${esc(slugId(item.term))}"><dt>${esc(item.term)}</dt><dd>${esc(item.text)}</dd></div>`)
    .join("");
  return `${header(copy.glossary.kicker, copy.glossary.title, copy.glossary.lede)}<dl class="glossary">${items}</dl>`;
}

function quizPage(state) {
  const quiz = state.site.quiz;
  const total = quiz.length;
  const index = Math.min(state.quizIndex, total);
  const done = index >= total;
  const correct = quiz.filter((item) => state.answers[item.id] === item.answer).length;
  const bar = done ? 100 : (index / total) * 100;
  let body;
  if (done) {
    body = `<div class="empty"><h2>${esc(copy.quiz.doneTitle)}</h2><p>${esc(copy.quiz.done(total, correct))}</p>
      <button type="button" class="btn btn-moss" data-action="reset-quiz">${esc(copy.quiz.again)}</button></div>`;
  } else {
    const question = quiz[index];
    const picked = state.answers[question.id];
    const choices = question.choices
      .map((choice) => {
        const chosen = picked === choice.id;
        const right = choice.id === question.answer;
        let cls = "choice";
        if (picked && right) cls += " choice-right";
        else if (picked && chosen && !right) cls += " choice-wrong";
        else if (picked) cls += " choice-dim";
        return `<li><button type="button" class="${cls}" data-action="answer" data-id="${esc(question.id)}" data-value="${esc(choice.id)}" ${picked ? "disabled" : ""}>${esc(choice.label)}</button></li>`;
      })
      .join("");
    const explain = picked
      ? `<div class="study"><p><strong>${picked === question.answer ? esc(copy.quiz.right) : esc(copy.quiz.wrong)}</strong></p><p>${esc(question.why)}</p>
          <button type="button" class="btn btn-moss" data-action="next-quiz" data-focus-key="quiz-next">${index + 1 === total ? esc(copy.quiz.overview) : esc(copy.quiz.next)}</button></div>`
      : "";
    body = `<section><h2 id="vraag-titel">${esc(question.prompt)}</h2><ul class="choices" role="group" aria-labelledby="vraag-titel" data-keys="move">${choices}</ul>${explain}</section>`;
  }
  const status = done ? copy.quiz.score(correct, total) : copy.quiz.progress(Math.min(index + 1, total), total);
  return `${header(copy.quiz.kicker, copy.quiz.title, copy.quiz.lede)}
    <p class="count-row"><span>${esc(status)}</span></p>
    <div class="bar" aria-hidden="true"><span style="width:${bar}%"></span></div>
    ${body}`;
}

function missingPage() {
  const links = [
    ["/", "Start"],
    ["/rassen", "Rassen"],
    ["/kaart", "Kaart"],
    ["/vergelijk", "Vergelijk"],
    ["/favorieten", "Bewaard"],
  ]
    .map(([href, label]) => `<li><a href="${href}">${label}</a></li>`)
    .join("");
  return `${header("", "Deze bladzijde staat niet in de gids.", "Kies iets in het menu hieronder, of ga terug naar de start.")}
    <ul class="recover">${links}</ul>`;
}

export function renderPage(state) {
  switch (state.path) {
    case "/":
      return homePage(state);
    case "/rassen":
      return rassenPage(state);
    case "/kaart":
      return mapPage(state);
    case "/vergelijk":
      return comparePage(state);
    case "/favorieten":
      return savedPage(state);
    case "/leren":
      return learnPage(state);
    case "/beroepen":
      return jobsPage(state);
    case "/legendes":
      return legendsPage(state);
    case "/beroemd":
      return famousPage(state);
    case "/verhalen":
      return storiesPage(state);
    case "/gangen":
      return gaitsPage(state);
    case "/lichaam":
      return bodyPage(state);
    case "/leven":
      return chapterPage(copy.life.kicker, copy.life.title, copy.life.lede, state.site.life);
    case "/geschiedenis":
      return chapterPage(copy.history.kicker, copy.history.title, copy.history.lede, state.site.history);
    case "/verzorging":
      return chapterPage(copy.care.kicker, copy.care.title, copy.care.lede, state.site.care);
    case "/weetjes":
      return factsPage(state);
    case "/woorden":
      return glossaryPage(state);
    case "/check":
      return quizPage(state);
    default:
      return missingPage();
  }
}

export function pageTitle(state) {
  if (!state.site) return "Alles over paarden";
  if (state.path === "/") return "Alles over paarden";
  if (state.path === "/rassen" && state.filters.ras) {
    const breed = state.site.breeds.find((item) => item.slug === state.filters.ras);
    return breed ? `${breed.name} — Alles over paarden` : "Rassen — Alles over paarden";
  }
  const names = {
    "/rassen": "Rassen",
    "/kaart": "Kaart",
    "/vergelijk": "Vergelijk",
    "/favorieten": "Bewaard",
    "/leren": "Leren",
    "/beroepen": "Beroepen",
    "/legendes": "Legendes",
    "/beroemd": "Beroemde paarden",
    "/verhalen": "Verhalen",
    "/gangen": "Gangen",
    "/lichaam": "Lichaam en zintuigen",
    "/leven": "Leven en gedrag",
    "/geschiedenis": "Geschiedenis",
    "/verzorging": "Verzorging",
    "/weetjes": "Weetjes",
    "/woorden": "Woordenlijst",
    "/check": "Check",
  };
  return `${names[state.path] ?? "Gids"} — Alles over paarden`;
}

export function shellStatus(state) {
  if (state?.bootError && !state.site) return bootMessage(state.online !== false);
  if (!state?.site) return "";
  if (state.notice) return state.notice;
  if (state.path === "/rassen" && state.filters?.ras) {
    const breed = state.site.breeds.find((item) => item.slug === state.filters.ras);
    if (!breed) return `${copy.rassen.missingTitle}. ${shellCopy.missingBreedNext}`;
    return pageTitle(state);
  }
  if (state.path === "/rassen") {
    const found = filterBreeds(state.site.breeds, state.filters, state.site.regionOrder);
    if (!found.length) return `${copy.rassen.empty} ${shellCopy.emptyRassenNext}`;
    return `${found.length} ${rasWord(found.length)}.`;
  }
  if (state.path === "/favorieten") {
    if (!state.saved?.length) return `${copy.savedPage.empty} ${shellCopy.emptySavedNext}`;
    return `Bewaard, ${state.saved.length} ${rasWord(state.saved.length)}.`;
  }
  if (state.path === "/kaart") {
    if (!state.filters?.streek) return `${shellCopy.emptyMap} ${shellCopy.emptyMapNext}`;
    const count = state.site.breeds.filter((breed) => breed.regions.includes(state.filters.streek)).length;
    if (!count) return shellCopy.emptyRegion;
    return `${state.filters.streek}, ${count} ${rasWord(count)}.`;
  }
  if (state.path === "/vergelijk") {
    const chosen = (state.compare ?? [])
      .map((slug) => state.site.breeds.find((breed) => breed.slug === slug))
      .filter(Boolean)
      .slice(0, 2);
    if (chosen.length < 2) {
      const lead = chosen.length === 1 ? shellCopy.emptyCompareOne : shellCopy.emptyCompareNone;
      return `${lead} ${shellCopy.emptyCompareNext}`;
    }
    return `${chosen[0].name} en ${chosen[1].name}.`;
  }
  if (state.path === "/gangen") {
    const gait = state.site.gaits.find((item) => item.id === state.gaitId) ?? state.site.gaits[0];
    const step = gait?.steps?.[state.gaitStep % (gait.steps?.length || 1)];
    if (gait && step) return `${gait.title}. ${step.label}`;
  }
  if (state.path === "/lichaam") {
    const part = state.site.body.find((item) => item.id === state.bodyId) ?? state.site.body[0];
    if (part) return part.name;
  }
  if (state.path === "/check") {
    const quiz = state.site.quiz ?? [];
    const index = Math.min(state.quizIndex ?? 0, quiz.length);
    if (!quiz.length || index >= quiz.length) return copy.quiz.doneTitle;
    const question = quiz[index];
    const picked = state.answers?.[question.id];
    if (picked) return `${picked === question.answer ? copy.quiz.right : copy.quiz.wrong} ${question.why}`;
    return copy.quiz.progress(Math.min(index + 1, quiz.length), quiz.length);
  }
  const title = pageTitle(state);
  if (title.startsWith("Gids —")) return shellCopy.missingPage;
  return title;
}

const tabs = [
  ["/", "Start", houseIcon()],
  ["/rassen", "Rassen", booksIcon()],
  ["/kaart", "Kaart", mapIcon()],
  ["/vergelijk", "Vergelijk", columnsIcon()],
  ["/favorieten", "Bewaard", bookmarkIcon()],
];

function icon(paths) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}
function houseIcon() {
  return icon(`<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`);
}
function booksIcon() {
  return icon(`<path d="M5 5.5h5.2A2.8 2.8 0 0 1 13 8.3V19a2.2 2.2 0 0 0-2.2-2.2H5zM19 5.5h-5.2A2.8 2.8 0 0 0 11 8.3V19a2.2 2.2 0 0 1 2.2-2.2H19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`);
}
function mapIcon() {
  return icon(`<path d="M9 5.5 4 7.2V18.5l5-1.7 6 1.7 5-1.7V5.5l-5 1.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 5.5v11.3M15 7.2v11.3" fill="none" stroke="currentColor" stroke-width="1.8"/>`);
}
function columnsIcon() {
  return icon(`<path d="M5 6h6v12H5zM13 6h6v12h-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`);
}
function bookmarkIcon() {
  return icon(`<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.2L6 20V5.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`);
}

export function renderNav(path, savedCount) {
  return tabs
    .map(([href, label, svg]) => {
      const on = href === "/rassen" ? path === "/rassen" : path === href;
      const extra = href === "/favorieten" && savedCount ? `<span class="badge" aria-hidden="true">${savedCount}</span>` : "";
      const name = href === "/favorieten" && savedCount ? `Bewaard, ${savedCount} ${rasWord(savedCount)}` : label;
      const labelAttr = name === label ? "" : ` aria-label="${esc(name)}"`;
      return `<a href="${href}" class="${on ? "tab tab-on" : "tab"}" ${on ? 'aria-current="page"' : ""}${labelAttr}>${svg}<span>${esc(label)}</span>${extra}</a>`;
    })
    .join("");
}

export function renderGids(site) {
  const links = site.learn
    .map(
      (item) => `<li><a href="${esc(item.to)}"><span>${esc(item.title)}</span><small>${esc(item.text)}</small></a></li>`,
    )
    .join("");
  return `<div class="sheet">
    <div class="sheet-bar">
      <h2 id="gids-title">In de gids</h2>
      <button type="button" class="btn btn-line" id="gids-sluit" data-action="close-gids" aria-label="Sluit de gids">Sluit</button>
    </div>
    <ul class="learn-grid">${links}</ul>
  </div>`;
}
