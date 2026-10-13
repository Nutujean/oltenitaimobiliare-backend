import test from "node:test";
import assert from "node:assert/strict";
import { CALARASI_LOCALITIES, canonicalCalarasiLocality, isCalarasiCounty } from "../data/calarasiLocalities.js";
import { validateImportedOffer, missingFromCompleteSnapshot } from "../utils/importValidation.js";

const basicOffer = {
  externalId: "agentie-123",
  county: "Călărași",
  locality: "Oltenița",
  category: "Case",
  title: "Casă de vânzare în Oltenița",
  description: "Casă cu trei camere, curte și acces la stradă, disponibilă pentru vizionare în Oltenița, județul Călărași.",
  price: 75000,
  currency: "EUR",
  phone: "0722123456",
  intent: "vand",
  images: ["https://exemplu-agentie.ro/img/casa1.jpg"],
  available: true,
  rightsGranted: true,
  consentReference: "contract-2026-10",
  sourceUrl: "https://exemplu-agentie.ro/oferte/agentie-123",
};

test("lista localităților județului este populată", () => {
  assert.equal(CALARASI_LOCALITIES.length, 162);
  assert.equal(canonicalCalarasiLocality("OLTENITA"), "Oltenița");
  assert.equal(canonicalCalarasiLocality("Chirnogi"), "Chirnogi");
  assert.equal(canonicalCalarasiLocality("București"), null);
});

test("acceptă ofertă reală autorizată exclusiv din Călărași", () => {
  const result = validateImportedOffer(basicOffer);
  assert.equal(result.ok, true);
  assert.equal(result.value.location, "Oltenița");
});

test("respinge județe diferite inclusiv dacă localitatea este validă", () => {
  for (const county of ["Ilfov", "Giurgiu", "Ialomița", "București", "Călărași, Ilfov"]) {
    assert.equal(validateImportedOffer({ ...basicOffer, county }).ok, false, county);
  }
  assert.equal(isCalarasiCounty("Județul Călărași"), true);
});

test("respinge localitate din alt județ chiar dacă județul este declarat Călărași", () => {
  assert.equal(validateImportedOffer({ ...basicOffer, locality: "Slobozia" }).ok, false);
  assert.equal(validateImportedOffer({ ...basicOffer, locality: "București" }).ok, false);
});

test("nu publică anunțuri fără drepturi, fotografii sau disponibilitate", () => {
  for (const patch of [
    { rightsGranted: false }, { consentReference: "" }, { images: [] },
    { available: false }, { sourceUrl: "http://exemplu.ro/casa" },
    { currency: "RON" }, { price: 0 },
  ]) assert.equal(validateImportedOffer({ ...basicOffer, ...patch }).ok, false, JSON.stringify(patch));
});

test("convertește telefonul internațional și ortografia localității", () => {
  const result = validateImportedOffer({ ...basicOffer, phone: "+40 722 123 456", locality: "Oltenita" });
  assert.equal(result.ok, true);
  assert.equal(result.value.phone, "0722123456");
  assert.equal(result.value.location, "Oltenița");
});

test("nu publică un anunț rămas în coadă dacă lipsește din feedul complet", () => {
  const now = new Date("2026-10-13T11:00:00Z");
  const record = { externalId: "agentie:123", lastSeenAt: new Date("2026-10-12T10:00:00Z") };
  assert.equal(missingFromCompleteSnapshot(record, new Set(), now), true);
  assert.equal(missingFromCompleteSnapshot(record, new Set(["agentie:123"]), now), false);
  assert.equal(missingFromCompleteSnapshot({ ...record, lastSeenAt: now }, new Set(), now), false);
});
