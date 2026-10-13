import test from "node:test";
import assert from "node:assert/strict";
import { parseAnuntulIndex } from "../utils/anuntulIndex.js";
import { PUBLIC_OFFER_FEEDS } from "../utils/publicOfferFeed.js";
const source = PUBLIC_OFFER_FEEDS[0];
const now = new Date("2026-10-13T07:00:00Z");
const card = (url, title, price, description) =>
  '<div class="card-title h5"><a class="stretched-link" href="' + url + '">' + title +
  '</a></div><div class="card-text fs-5 fw-bold text-red-at">' + price +
  '</div><p class="d-none d-md-block mb-0">' + description + '</p>';
const html = '<html><body>' +
  card('/anunt-vanzare-teren-comuna-borcea-jud-calarasi-doDo21#anchor',
    'Comuna Borcea, jud. Calarasi', '16.000 €',
    'Proprietar, vand teren extravilan 27.332 mp pe teritoriul comunei Borcea, jud. Calarasi.') +
  card('/anunt-vanzare-casa-comuna-curcani-jud-calarasi-BJvNVX#anchor',
    'Comuna Curcani, jud. Calarasi, vanzare casa 5 camere, teren 1320 mp',
    '124.000 €', 'Casa cu 5 camere si teren 1320 mp in comuna Curcani, judetul Calarasi.') +
  card('/anunt-vanzare-apartament-bucuresti-CV77',
    'București', '101.000 €', 'Apartament de vanzare in Bucuresti.') +
  '</body></html>';

test("indexul Călărași produce referințe fără imagini, telefon sau text copiat", () => {
  const parsed = parseAnuntulIndex(html, source, now);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].locality, "Borcea");
  assert.equal(parsed[0].category, "Terenuri");
  assert.equal(parsed[0].priceEUR, 16000);
  assert.ok(parsed[0].sourceUrl.startsWith("https://www.anuntul.ro/anunt-vanzare-teren-"));
  assert.equal(parsed[1].locality, "Curcani");
  assert.equal(parsed[1].priceEUR, 124000);
  assert.equal(Object.hasOwn(parsed[0], "images"), false);
  assert.equal(Object.hasOwn(parsed[1], "phone"), false);
  assert.ok(parsed[0].summary.includes("Verifică prețul"));
});

test("blochează surse excluse, origini modificate și indexuri de alte județe", () => {
  assert.deepEqual(parseAnuntulIndex(html, { ...source, name: "Oltenițeanul" }, now), []);
  assert.deepEqual(parseAnuntulIndex(html, { ...source, origin: "https://site-fals.ro" }, now), []);
  assert.deepEqual(parseAnuntulIndex(html, { ...source, feedUrl: "https://www.anuntul.ro/judetul-ilfov" }, now), []);
});
