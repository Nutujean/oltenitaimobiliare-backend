import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_OFFER_FEEDS, parsePropertyRss, normalizeRssOffer, isExcludedExternalSource } from "../utils/publicOfferFeed.js";

const source = { id: "example-only", name: "Site exemplu",
  feedUrl: "https://example.com/feed", origin: "https://example.com" };
const now = new Date("2026-10-13T09:00:00Z");
const date = "Mon, 12 Oct 2026 12:00:00 +0000";
function item(patch = {}) {
  return {
    title: "Casă de vânzare în Oltenița – 75.000 euro",
    link: "https://example.com/casa-de-vanzare-test/",
    excerpt: "Casă de vânzare în municipiul Oltenița. Informații în anunțul original.",
    date, ...patch,
  };
}
test("parserul citește RSS cu CDATA și nu importă corpul complet", () => {
  const xml = '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
    '<title><![CDATA[Casă de vânzare în Oltenița – 75.000 euro]]></title>' +
    '<link>https://example.com/casa-de-vanzare-test/</link>' +
    '<description><![CDATA[<p>Casă în Oltenița. Județul Călărași.</p>]]></description>' +
    '<pubDate>Mon, 12 Oct 2026 12:00:00 +0000</pubDate></item></channel></rss>';
  const parsed = parsePropertyRss(xml);
  assert.equal(parsed.length, 1);
  assert.ok(parsed[0].title.includes("Oltenița"));
  assert.ok(parsed[0].excerpt.includes("Județul Călărași"));
});
test("acceptă numai localitate dovedită din Călărași, cu link la sursă", () => {
  const result = normalizeRssOffer(item(), source, now);
  assert.ok(result);
  assert.equal(result.locality, "Oltenița");
  assert.equal(result.priceEUR, 75000);
  assert.equal(result.sourceUrl, "https://example.com/casa-de-vanzare-test/");
  assert.equal(result.summary.includes("Verifică prețul"), true);
  assert.equal(Object.hasOwn(result, "images"), false);
  assert.equal(Object.hasOwn(result, "phone"), false);
});
test("refuză localitate ambiguă fără județ și alt județ declarat", () => {
  assert.equal(normalizeRssOffer(item({
    title: "Casă de vânzare în Ulmeni", excerpt: "Casă de vânzare în Ulmeni",
  }), source, now), null);
  assert.equal(normalizeRssOffer(item({
    title: "Casă de vânzare în Ulmeni", excerpt: "Casă de vânzare în Ulmeni, județul Călărași",
  }), source, now)?.locality, "Ulmeni");
  assert.equal(normalizeRssOffer(item({
    excerpt: "Casă de vânzare în Oltenița, județul Giurgiu",
  }), source, now), null);
});
test("refuză pagini externe, anunțuri vechi și articole neimobiliare", () => {
  assert.equal(normalizeRssOffer(item({ link: "https://exemplu.ro/ann/" }), source, now), null);
  assert.equal(normalizeRssOffer(item({ date: "Mon, 02 Feb 2025 12:00:00 +0000" }), source, now), null);
  assert.equal(normalizeRssOffer(item({ title: "Știri de azi în Oltenița" }), source, now), null);
  assert.equal(normalizeRssOffer(item({ title: "Casă de vânzare în București", excerpt:"" }), source, now), null);
});
test("nu ghicește prețul dacă este lipsă și nu adaugă imagini", () => {
  const result = normalizeRssOffer(item({ title: "Apartament 3 camere de vânzare în Oltenița" }), source, now);
  assert.ok(result);
  assert.equal(result.priceEUR, null);
  assert.equal(result.category, "Apartamente");
});

test("exclude necondiționat publicația indicată de proprietarul portalului", () => {
  assert.ok(PUBLIC_OFFER_FEEDS.every((source) => !isExcludedExternalSource(source.feedUrl, source.name)));
  assert.equal(isExcludedExternalSource("https://olteniteanul.ro/anunturi/"), true);
  assert.equal(isExcludedExternalSource("https://www.olteniteanul.ro/anunturi/"), true);
  assert.equal(isExcludedExternalSource("https://facebook.com/olteniteanul/posts/123"), true);
  assert.equal(isExcludedExternalSource("https://www.facebook.com/Olteniteanul"), true);
  assert.equal(isExcludedExternalSource("https://facebook.com/altapagina", "Oltenițeanul"), true);
  assert.equal(isExcludedExternalSource("https://example.com/anunturi/"), false);
  assert.equal(normalizeRssOffer(item({ link: "https://example.com/ann/" }),
    { ...source, name: "Oltenițeanul" }, now), null);
});
