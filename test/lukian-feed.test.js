import test from "node:test";
import assert from "node:assert/strict";
import { mapLukianProperty, validLukianFeedConfig } from "../utils/lukianFeedMapping.js";

const config = {
  sourceId: "lukian_partner", portal: "oltenitaimobiliare",
  apiKey: "placeholder-portal-key-never-real",
  consentReference: "ACORD-SCRIS-2026",
  rightsConfirmed: true,
  activeOnlyConfirmed: true,
  allowedAgencyIds: ["agentia_calarasi"],
};
const agencies = {
  agentia_calarasi: { phone: "+40 722 123 456", email: "contact@agentie.ro" },
};
const property = {
  id: 781, agency_id: "agentia_calarasi",
  title: "Apartament 3 camere în municipiul Oltenița",
  property_type: "apartment",
  transaction_type: "sale", price: 76500, currency: "EUR",
  location: { city: "Oltenita", county: "Călărași" },
  description: "<p>Apartament decomandat situat în Oltenița, cu trei camere, balcon și bucătărie separată, disponibil pentru vizionări.</p>",
  photos: ["https://agentie.ro/fotografii/781.jpg"],
  url: "https://agentie.ro/proprietati/781",
  agent: { phone: "+40 722 123 456" },
};

test("configurația fără contract sau fără agenție permisă este respinsă", () => {
  assert.equal(validLukianFeedConfig(config), true);
  assert.equal(validLukianFeedConfig({ ...config, rightsConfirmed: false }), false);
  assert.equal(validLukianFeedConfig({ ...config, activeOnlyConfirmed: false }), false);
  assert.equal(validLukianFeedConfig({ ...config, allowedAgencyIds: [] }), false);
  assert.equal(validLukianFeedConfig({ ...config, apiKey: "" }), false);
});

test("mapează ofertă autorizată în Călărași și curăță HTML din descriere", () => {
  const r = mapLukianProperty(property, config, agencies);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.value.externalId, "agentia_calarasi:781");
  assert.equal(r.value.location, "Oltenița");
  assert.equal(r.value.phone, "0722123456");
  assert.equal(r.value.category, "Apartamente");
  assert.equal(r.value.county, "Călărași");
  assert.equal(r.value.description.includes("<p>"), false);
});

test("fără județ confirmat respinge chiar dacă localitatea există", () => {
  const p = { ...property, location: { city: "Oltenita" } };
  assert.equal(mapLukianProperty(p, config, agencies).ok, false);
  const scoped = { ...config, countyScopeConfirmed: "Călărași" };
  assert.equal(mapLukianProperty(p, scoped, agencies).ok, true);
});

test("județ explicit diferit blochează chiar și cu garanția de județ pe sursă", () => {
  const scoped = { ...config, countyScopeConfirmed: "Călărași" };
  for (const county of ["Ialomița", "Ilfov", "Giurgiu", "București"]) {
    const p = { ...property, location: { city: "Oltenița", county } };
    assert.equal(mapLukianProperty(p, scoped, agencies).ok, false, county);
  }
});

test("respinge localități din alte județe și alte agenții", () => {
  assert.equal(mapLukianProperty({ ...property, location: { city: "Slobozia", county: "Călărași" } }, config, agencies).ok, false);
  assert.equal(mapLukianProperty({ ...property, agency_id: "alte_agentii" }, config, agencies).ok, false);
});

test("nu permite proprietăți fără poze, preț în euro sau descriere verificabilă", () => {
  for (const patch of [
    { photos: [] },
    { id: null },
    { currency: "RON" },
    { property_type: "hotel" },
    { description: "<p>ok</p>" },
    { url: "http://agentie.ro/proprietati/781" },
  ]) assert.equal(mapLukianProperty({ ...property, ...patch }, config, agencies).ok, false);
});

test("mapează închiriere și casă numai dacă e în județ", () => {
  const r = mapLukianProperty({
    ...property, property_type: "house", transaction_type: "rent",
    location: { city: "Fundulea", county: "Călărași" },
  }, config, agencies);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.value.category, "Case");
  assert.equal(r.value.intent, "inchiriez");
});
