import { canonicalCalarasiLocality, isCalarasiCounty, normalizePlace } from "../data/calarasiLocalities.js";
import { isExcludedExternalSource } from "./publicOfferFeed.js";

const CATEGORIES = new Map([
  ["apartamente", "Apartamente"], ["garsoniere", "Garsoniere"], ["case", "Case"],
  ["terenuri", "Terenuri"], ["spatii comerciale", "Spatii comerciale"], ["garaje", "Garaje"],
]);

export function normalizeImportPhone(value = "") {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("40") && digits.length === 11) digits = "0" + digits.slice(2);
  return digits;
}

export function validateImportedOffer(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const externalId = String(o.externalId || "").trim();
  const sourceUrl = String(o.sourceUrl || "").trim();
  const consentReference = String(o.consentReference || "").trim();
  const title = String(o.title || "").trim().replace(/\s+/g, " ");
  const description = String(o.description || "").trim().replace(/\s+/g, " ");
  const location = canonicalCalarasiLocality(o.locality || "");
  const category = CATEGORIES.get(normalizePlace(o.category));
  const price = Number(o.price);
  const phone = normalizeImportPhone(o.phone);
  const intent = ["inchiriez", "inchiriere"].includes(normalizePlace(o.intent)) ? "inchiriez" : "vand";
  const email = String(o.email || "").trim();
  const images = Array.isArray(o.images) ? [...new Set(o.images)] : [];

  if (!externalId || externalId.length > 160) return { ok: false, error: "externalId obligatoriu (max. 160)" };
  if (!isCalarasiCounty(o.county) || !location) return { ok: false, error: "Județul/localitatea nu aparține listei Călărași" };
  if (o.rightsGranted !== true || !consentReference || consentReference.length > 200) {
    return { ok: false, error: "Lipsește acordul verificabil de republicare (rightsGranted, consentReference)" };
  }
  if (!/^https:\/\//i.test(sourceUrl) || sourceUrl.length > 1500) return { ok: false, error: "sourceUrl HTTPS obligatoriu" };
  if (isExcludedExternalSource(sourceUrl, o.sourceName || "")) return { ok: false, error: "Sursă exclusă explicit" };
  if (o.available !== true) return { ok: false, error: "Oferta nu este confirmată ca disponibilă" };
  if (o.currency && String(o.currency).toUpperCase() !== "EUR") return { ok: false, error: "Doar prețuri EUR" };
  if (!category || !["vand", "inchiriez", "vanzare", "inchiriere"].includes(normalizePlace(o.intent))) {
    return { ok: false, error: "Categorie sau tip tranzacție invalid" };
  }
  if (title.length < 12 || title.length > 180 || description.length < 60 || description.length > 12000) {
    return { ok: false, error: "Titlul (12–180) sau descrierea (60–12000) sunt prea scurte/lungi" };
  }
  if (!Number.isFinite(price) || price <= 0 || price > 100000000) return { ok: false, error: "Preț EUR invalid" };
  if (!/^0[237]\d{8}$/.test(phone)) return { ok: false, error: "Telefon românesc invalid" };
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)) return { ok: false, error: "Email invalid" };
  if (images.length < 1 || images.length > 10 || images.some((url) => typeof url !== "string" || !/^https:\/\//i.test(url) || url.length > 1800)) {
    return { ok: false, error: "Sunt necesare 1–10 fotografii HTTPS autorizate" };
  }
  return {
    ok: true,
    value: {
      externalId, sourceUrl, consentReference, county: "Călărași", location,
      title, description, category, price, phone, email, intent,
      images, available: true, rightsGranted: true,
    },
  };
}

export function missingFromCompleteSnapshot(record, seenIds, now = new Date()) {
  const lastSeen = record?.lastSeenAt ? new Date(record.lastSeenAt).getTime() : NaN;
  return Number.isFinite(lastSeen) &&
    lastSeen < now.getTime() &&
    !seenIds.has(String(record.externalId || ""));
}
