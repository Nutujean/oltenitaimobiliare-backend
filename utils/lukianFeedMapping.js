// Mapare pentru schema Lukian Portal Feed API v2: https://lukian.ai/ro/portaluri-imobiliare/feed-api
// Nu acordăm implicit drepturi de republicare și nu inventăm județul când lipsește.
import { normalizePlace } from "../data/calarasiLocalities.js";
import { validateImportedOffer } from "./importValidation.js";

const propertyTypes = Object.freeze({
  apartment: "Apartamente", studio: "Garsoniere", house: "Case",
  land: "Terenuri", commercial: "Spatii comerciale", office: "Spatii comerciale",
  garage: "Garaje",
});
const transactions = Object.freeze({
  sale: "vand", rent: "inchiriez",
  vanzare: "vand", inchiriere: "inchiriez",
});
const htmlEntities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function descriptionText(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      if (entity.startsWith("#")) {
        const isHex = entity[1]?.toLowerCase() === "x";
        const value = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
      }
      return htmlEntities[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ").trim();
}

export function validLukianFeedConfig(config) {
  return Boolean(
    config && typeof config === "object" &&
    /^[a-z0-9_-]{3,60}$/i.test(String(config.sourceId || "")) &&
    /^[a-z0-9_-]{3,60}$/i.test(String(config.portal || "")) &&
    typeof config.apiKey === "string" && config.apiKey.length >= 16 &&
    config.rightsConfirmed === true &&
    config.activeOnlyConfirmed === true &&
    typeof config.consentReference === "string" &&
    config.consentReference.trim().length >= 3 &&
    config.consentReference.length <= 200 &&
    Array.isArray(config.allowedAgencyIds) &&
    config.allowedAgencyIds.length > 0 &&
    config.allowedAgencyIds.every((id) => /^[a-z0-9_-]{1,100}$/i.test(String(id)))
  );
}

export function mapLukianProperty(raw, config, agencies = {}) {
  if (!validLukianFeedConfig(config)) return { ok: false, error: "Configurație/autorizare neconfirmată" };
  if (!raw || typeof raw !== "object") return { ok: false, error: "Proprietate invalidă" };
  const agencyId = String(raw.agency_id || "");
  if (!config.allowedAgencyIds.includes(agencyId)) {
    return { ok: false, error: "Agenție în afara acordului" };
  }
  const agency = agencies[agencyId] || {};
  const city = raw.location?.city || raw.location?.locality || "";
  // Feed API v2 documentat nu include neapărat county. În lipsa lui, e obligatoriu
  // un acord pentru un feed filtrat/garantat exclusiv pe județul Călărași.
  const declaredCounty = raw.location?.county || raw.location?.judet || raw.county || "";
  const county = declaredCounty || (
    config.countyScopeConfirmed === "Călărași" ? "Călărași" : ""
  );
  // Dacă feedul afirmă explicit un alt județ, refuzăm chiar și cu garanție contractuală.
  if (declaredCounty && normalizePlace(declaredCounty) !== "calarasi") {
    return { ok: false, error: "Alt județ în oferta de origine" };
  }
  const category = propertyTypes[normalizePlace(raw.property_type)] || "";
  const intent = transactions[normalizePlace(raw.transaction_type)] || "";
  const externalId = String(raw.id ?? "").trim();
  if (!externalId || externalId.length > 100) return { ok: false, error: "ID de proprietate lipsă/invalid" };
  const offer = {
    externalId: agencyId + ":" + externalId,
    sourceUrl: raw.url,
    consentReference: config.consentReference,
    rightsGranted: true,
    available: raw.available !== false && raw.status !== "sold" && raw.status !== "withdrawn",
    county, locality: city, category, intent,
    title: raw.title, description: descriptionText(raw.description),
    price: raw.price, currency: raw.currency,
    images: raw.photos, phone: raw.agent?.phone || agency.phone,
    email: raw.agent?.email || agency.email || "",
  };
  return validateImportedOffer(offer);
}
