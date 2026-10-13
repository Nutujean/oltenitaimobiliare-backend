import Listing from "../models/Listing.js";
import ImportOffer from "../models/ImportOffer.js";
import { mapLukianProperty, validLukianFeedConfig } from "./lukianFeedMapping.js";
import { missingFromCompleteSnapshot } from "./importValidation.js";

const MAX_FEED_BYTES = 15 * 1024 * 1024;
const MAX_PROPERTIES = 25000;
const MAX_PER_RUN = 1000;

export function readLukianFeeds() {
  try {
    const feeds = JSON.parse(process.env.AUTHORIZED_LUKIAN_FEEDS_JSON || "[]");
    return Array.isArray(feeds) ? feeds.filter(validLukianFeedConfig) : [];
  } catch {
    return [];
  }
}

async function downloadFeed(config, fetchImpl) {
  // Domeniu și cale fixe. Nu se acceptă URL-uri arbitrare (SSRF).
  const url = new URL(
    "https://api.lukian.ai/api/v2/portals/" +
    encodeURIComponent(config.portal) + "/feed.json"
  );
  url.searchParams.set("api_key", config.apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET", redirect: "error", signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const size = Number(response.headers.get("content-length") || 0);
    if (size > MAX_FEED_BYTES) throw new Error("Feed prea mare");
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_FEED_BYTES) throw new Error("Feed prea mare");
    const body = JSON.parse(text);
    if (!body || !Array.isArray(body.properties) ||
      body.properties.length > MAX_PROPERTIES ||
      !Array.isArray(body.agencies)) {
      throw new Error("Format feed JSON invalid");
    }
    // O fotografie lipsă/agenție greșită poate fi respinsă individual, dar nu
    // interpretăm un feed incomplet ca fiind autorizat pentru retrageri.
    if (Number.isInteger(body.total_properties) &&
      body.total_properties !== body.properties.length) {
      throw new Error("Număr de proprietăți inconsistent");
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function withdraw(sourceId, externalId) {
  const offer = await ImportOffer.findOneAndUpdate(
    { sourceId, externalId },
    { $set: { status: "withdrawn", available: false, lastSeenAt: new Date() } },
    { new: true }
  );
  if (offer?.listing) {
    await Listing.updateOne(
      { _id: offer.listing, importSourceId: sourceId, importExternalId: externalId },
      { $set: { visibility: "draft", status: "expirat" } }
    );
  }
}

async function synchronizeValidOffer(sourceId, offer, now) {
  const existing = await ImportOffer.findOne({
    sourceId, externalId: offer.externalId,
  }).select("status listing").lean();

  if (existing?.status === "withdrawn" || existing?.status === "duplicate") {
    // Nu reactivăm o ofertă retrasă anterior în lipsa unei noi înțelegeri/ID.
    return "skipped";
  }
  if (existing?.status === "published" && existing.listing) {
    const updated = await Listing.updateOne(
      { _id: existing.listing, importSourceId: sourceId,
        importExternalId: offer.externalId, vandut: { $ne: true } },
      { $set: {
        title: offer.title, description: offer.description,
        price: offer.price, location: offer.location, category: offer.category,
        phone: offer.phone, email: offer.email, images: offer.images,
        imageUrl: offer.images[0], intent: offer.intent,
        dealType: offer.intent === "inchiriez" ? "inchiriere" : "vanzare",
        importConsentReference: offer.consentReference,
        importSourceUrl: offer.sourceUrl,
        status: "disponibil", visibility: "public",
        expiresAt: new Date(now.getTime() + 30 * 86400000),
      }}
    );
    if (updated.matchedCount) {
      await ImportOffer.updateOne(
        { sourceId, externalId: offer.externalId, status: "published" },
        { $set: { lastSeenAt: now, sourceUrl: offer.sourceUrl, rightsGranted: true, available: true } }
      );
      return "updated";
    }
    return "skipped";
  }

  // Persistăm oferta în coada pentru publicarea zilnică, nu o publicăm pe loc.
  await ImportOffer.findOneAndUpdate(
    { sourceId, externalId: offer.externalId },
    { $set: { ...offer, sourceId, status: "queued", lastSeenAt: now, lastError: "" } },
    { upsert: true, new: true, runValidators: true }
  );
  return "queued";
}

export async function pullAuthorizedLukianFeeds({ fetchImpl = fetch, now = new Date() } = {}) {
  if (process.env.AUTOPUBLISH_ENABLED !== "true") return { status: "disabled", feeds: 0 };
  const feeds = readLukianFeeds();
  if (feeds.length === 0) return { status: "unconfigured", feeds: 0 };
  const summary = { status: "ok", feeds: 0, queued: 0, updated: 0, withdrawn: 0, rejected: 0, errors: 0 };

  for (const config of feeds) {
    try {
      const snapshot = await downloadFeed(config, fetchImpl);
      const agencies = Object.fromEntries(snapshot.agencies.map((a) => [String(a.id), a]));
      const seen = new Set();
      // Doar agențiile explicit permise și doar proprietățile eligibile.
      const latestFirst = [...snapshot.properties].sort((a, b) => {
        const left = Date.parse(a?.updated_at || a?.created_at || "") || 0;
        const right = Date.parse(b?.updated_at || b?.created_at || "") || 0;
        return right - left;
      });
      for (const property of latestFirst.slice(0, MAX_PER_RUN)) {
        const agencyId = String(property?.agency_id || "");
        const id = String(property?.id ?? "").trim();
        if (!config.allowedAgencyIds.includes(agencyId) || !id) {
          summary.rejected++;
          continue;
        }
        const externalId = agencyId + ":" + id;
        seen.add(externalId);
        const isWithdrawn = property.available === false ||
          ["sold", "withdrawn", "deleted", "rented", "inactive"].includes(String(property.status || "").toLowerCase());
        if (isWithdrawn) {
          await withdraw(config.sourceId, externalId);
          summary.withdrawn++;
          continue;
        }

        const checked = mapLukianProperty(property, config, agencies);
        if (!checked.ok) {
          // O ofertă care își pierde județul verificabil, drepturile sau pozele
          // nu poate rămâne publică prin simpla actualizare a feedului.
          const previous = await ImportOffer.exists({
            sourceId: config.sourceId, externalId, status: "published",
          });
          if (previous) {
            await withdraw(config.sourceId, externalId);
            summary.withdrawn++;
          }
          summary.rejected++;
          continue;
        }
        const result = await synchronizeValidOffer(config.sourceId, checked.value, now);
        if (result === "queued") summary.queued++;
        if (result === "updated") summary.updated++;
      }

      // Retragerea ofertelor dispărute este permisă doar pe snapshot complet,
      // confirmat contractual. Așteptăm >=24h pentru a evita întreruperile scurte.
      if (config.completeSnapshotConfirmed === true &&
        snapshot.properties.length <= MAX_PER_RUN) {
        // Un anunț care nu mai apare în feedul complet NU trebuie publicat
        // ulterior din coada de așteptare, chiar dacă fusese valid anterior.
        const missingQueued = await ImportOffer.find({
          sourceId: config.sourceId, status: "queued",
          lastSeenAt: { $lt: now },
        }).select("externalId").lean();
        for (const queued of missingQueued) {
          if (missingFromCompleteSnapshot(queued, seen, now)) {
            await withdraw(config.sourceId, queued.externalId);
            summary.withdrawn++;
          }
        }
        const stale = await ImportOffer.find({
          sourceId: config.sourceId, status: "published",
          lastSeenAt: { $lt: new Date(now.getTime() - 24 * 3600000) },
        }).select("externalId").lean();
        for (const offer of stale) {
          if (!seen.has(offer.externalId)) {
            await withdraw(config.sourceId, offer.externalId);
            summary.withdrawn++;
          }
        }
      }
      summary.feeds++;
    } catch (error) {
      // Nu logăm URL-ul API cu cheia sau întregul corp al erorii.
      console.error("Feed Lukian invalid (" + config.sourceId + "):",
        error?.name === "AbortError" ? "timeout" : String(error.message || "eroare").slice(0, 120));
      summary.errors++;
    }
  }
  return summary;
}
