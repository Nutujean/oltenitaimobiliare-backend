import { canonicalCalarasiLocality, CALARASI_LOCALITIES, normalizePlace } from "../data/calarasiLocalities.js";

export const PUBLIC_OFFER_FEEDS = Object.freeze([
  { id: "olteniteanul-imobiliare", name: "Oltenițeanul",
    feedUrl: "https://www.olteniteanul.ro/category/imobiliare-oltenita/feed/",
    origin: "https://www.olteniteanul.ro" },
]);

function decode(str) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", euro: "€", ndash: "–", mdash: "—" };
  return String(str || "").replace(/&(#\d+|#x[\da-f]+|amp|quot|apos|lt|gt|nbsp|euro|ndash|mdash);/gi, (_m, key) => {
    if (key.startsWith("#")) {
      const hex = key[1]?.toLowerCase() === "x";
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    }
    return named[key.toLowerCase()] ?? " ";
  });
}

function textOf(xml, name) {
  const match = xml.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i"));
  return decode((match?.[1] || "").replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

export function parsePropertyRss(xml) {
  if (typeof xml !== "string" || xml.length > 1500000 || !/<rss\b|<rdf:RDF\b/i.test(xml)) {
    throw new Error("RSS invalid sau prea mare");
  }
  return (xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || []).slice(0, 80)
    .map((block) => ({
      title: textOf(block, "title"), link: textOf(block, "link"),
      excerpt: textOf(block, "description"), date: textOf(block, "pubDate"),
    }));
}

function categoryOf(text) {
  if (/\bgarsonier/.test(text)) return "Garsoniere";
  if (/\bapartament/.test(text)) return "Apartamente";
  if (/\bteren\b|\bparcela\b/.test(text)) return "Terenuri";
  if (/\bspatiu comercial\b|\bspatii comerciale\b|\bcladire comerciala\b/.test(text)) return "Spatii comerciale";
  if (/\b(casa|case|vila)\b/.test(text)) return "Case";
  if (/\bgaraj\b/.test(text)) return "Garaje";
  return null;
}

function detectLocality(title, excerpt) {
  const titleNorm = " " + normalizePlace(title) + " ";
  const excerptNorm = " " + normalizePlace(excerpt) + " ";
  const hasCounty = /\bjud(?:etul|et|\.?)?\s+calarasi\b/.test(excerptNorm + titleNorm);
  const candidates = CALARASI_LOCALITIES.filter((name) => name !== "Călărași")
    .sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    const normalized = normalizePlace(name);
    const escaped = normalized.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    const re = new RegExp("(^|[^a-z])" + escaped + "([^a-z]|$)");
    if (!re.test(titleNorm) && !re.test(excerptNorm)) continue;
    if (name !== "Oltenița" && !hasCounty) continue;
    return canonicalCalarasiLocality(name);
  }
  if (/\b(municipiul|orasul|in)\s+calarasi\b/.test(titleNorm)) return "Călărași";
  return null;
}

function parsePriceEUR(text) {
  const matches = [...text.matchAll(/(?:^|[^\d])(\d{1,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?|\d{4,7})\s*(€|euro|eur)(?![a-z])/gi)];
  const prices = [...new Set(matches.map((m) => Number(m[1].replace(/[.\s]/g, "").replace(",", "."))).filter((n) => n >= 1000 && n <= 10000000))];
  return prices.length === 1 ? prices[0] : null;
}

export function normalizeRssOffer(item, source, now = new Date()) {
  if (!item || !source || typeof source.origin !== "string") return null;
  const title = String(item.title || "").trim().replace(/\s+/g, " ");
  const excerpt = String(item.excerpt || "").trim();
  const plain = normalizePlace(title + " " + excerpt);
  if (title.length < 14 || title.length > 180) return null;
  if (!/\b(vand|vinde|vanzare|inchiriez|inchiriere|se ofera)\b/.test(plain)) return null;
  const category = categoryOf(plain);
  const locality = detectLocality(title, excerpt);
  if (!category || !locality) return null;
  if (/\bjud(?:etul|et|\.?)?\s+(ilfov|giurgiu|ialomita|teleorman|constanta|bucuresti)\b/.test(plain)) return null;
  const sourceDate = new Date(item.date);
  const age = now.getTime() - sourceDate.getTime();
  if (!Number.isFinite(age) || age < -2 * 86400000 || age > 120 * 86400000) return null;
  let url;
  try {
    url = new URL(item.link);
    if (url.protocol !== "https:" || url.origin !== source.origin) return null;
    url.hash = ""; url.search = "";
  } catch { return null; }
  const room = plain.match(/\b([1-9]) camere\b/);
  const surface = plain.match(/\b(\d{2,4})\s*(?:mp|m2|m²)\b/);
  const features = [room?.[0], surface?.[0]].filter(Boolean);
  const intent = /\binchiri/.test(plain) ? "inchiriez" : "vand";
  const summary = [
    "Ofertă " + (intent === "inchiriez" ? "de închiriere" : "de vânzare") +
      " pentru " + category.toLowerCase() + " în " + locality + ", județul Călărași.",
    features.length ? "Detalii menționate: " + features.join(", ") + "." : "",
    "Verifică prețul, disponibilitatea și datele complete direct la sursa originală.",
  ].filter(Boolean).join(" ");
  return {
    sourceId: source.id, sourceName: source.name, sourceUrl: url.toString(),
    sourcePublishedAt: sourceDate, title, locality, category, intent, summary,
    priceEUR: parsePriceEUR(title),
  };
}
