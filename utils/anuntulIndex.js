import { CALARASI_LOCALITIES, normalizePlace } from "../data/calarasiLocalities.js";
import { isExcludedExternalSource } from "./publicOfferFeed.js";

const ROOT = "https://www.anuntul.ro";
const CATEGORIES = [
  [/garsonier/, "Garsoniere", "Garsonieră"],
  [/apartament/, "Apartamente", "Apartament"],
  [/casa|vila/, "Case", "Casă"],
  [/teren/, "Terenuri", "Teren"],
  [/spatiu|spatii|comercial/, "Spatii comerciale", "Spațiu comercial"],
  [/garaj/, "Garaje", "Garaj"],
];
function plain(html = "") {
  return String(html).replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim();
}
function localityFor(heading, excerpt) {
  const text = " " + normalizePlace(heading + " " + excerpt)
    .replace(/\bjud(?:etul|et|\.?)?\s+calarasi\b/g, " ") + " ";
  for (const city of [...CALARASI_LOCALITIES].sort((a,b) => b.length-a.length)) {
    const candidate = normalizePlace(city);
    if (text.includes(" " + candidate + " ") ||
        text.includes(" " + candidate + ",") ||
        text.includes(" " + candidate + ".")) return city;
  }
  return null;
}
export function parseAnuntulIndex(html, source, now = new Date()) {
  if (!source || source.origin !== ROOT ||
      !source.feedUrl.includes("/judetul-calarasi") ||
      isExcludedExternalSource(source.feedUrl, source.name) ||
      typeof html !== "string" || html.length > 2000000 ||
      !/<html[\s>]/i.test(html)) return [];
  const pattern = /<div\s+class="card-title h5">\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi;
  const cards = [...html.matchAll(pattern)].slice(0, 100);
  const result = [];
  for (let i = 0; i < cards.length; i++) {
    const match = cards[i];
    const boundary = cards[i + 1]?.index ?? html.length;
    const rest = html.slice(match.index+match[0].length, Math.min(boundary,match.index+1600));
    const priceText = rest.match(/<div\s+class="card-text fs-5 fw-bold text-red-at">([\s\S]*?)<\/div>/i);
    if (!priceText) continue;
    const excerpt = plain((rest.match(/<p\b[^>]*class="[^"]*d-none d-md-block[^"]*"[^>]*>([\s\S]*?)<\/p>/i)||[])[1] || "");
    const href = match[1].split("#")[0].trim();
    if (!href.startsWith("/anunt-vanzare-")) continue;
    const category = CATEGORIES.find(([pattern])=>pattern.test(href));
    const city = localityFor(plain(match[2]),excerpt);
    if (!category || !city) continue;
    let url;
    try {
      url = new URL(href,ROOT);
      if (url.origin !== ROOT || isExcludedExternalSource(url.href,source.name)) continue;
    } catch { continue; }
    const priceString = plain(priceText[1]).replace(/\s/g,"");
    if (!/€|EUR/i.test(priceString)) continue;
    const priceEUR = Number(priceString.replace(/[^0-9,.]/g,"").replace(/\./g,"").replace(",","."));
    if (!Number.isFinite(priceEUR) || priceEUR < 100 || priceEUR > 10000000) continue;
    const normalized = normalizePlace(excerpt);
    const features = [
      normalized.match(/\b[1-9]\s*camere\b/)?.[0],
      normalized.match(/\b\d{2,5}\s*(mp|m2)\b/)?.[0],
    ].filter(Boolean);
    result.push({
      sourceId: source.id, sourceName: source.name, sourceUrl: url.href,
      sourcePublishedAt: now,
      title: category[2] + " de vânzare în " + city + ", județul Călărași",
      locality: city, category: category[1], intent:"vand", priceEUR,
      summary: "Ofertă de vânzare pentru " + category[1].toLowerCase() +
        " în " + city + ", județul Călărași. " +
        (features.length ? "Caracteristici menționate: " + features.join(", ") + ". " : "") +
        "Verifică prețul, disponibilitatea și contactul direct la sursa originală.",
    });
  }
  return result;
}
