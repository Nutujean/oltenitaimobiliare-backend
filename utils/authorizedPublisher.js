import crypto from "node:crypto";
import Listing from "../models/Listing.js";
import ImportOffer from "../models/ImportOffer.js";
import ImportLease from "../models/ImportLease.js";
import { validateImportedOffer } from "./importValidation.js";
import { sendEmail } from "./sendEmail.js";

const MAX_PER_DAY = 2;
const DAY_ZONE = "Europe/Bucharest";

export function localDayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DAY_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (part) => parts.find((p) => p.type === part)?.value;
  return [get("year"), get("month"), get("day")].join("-");
}

function normalize(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function wordScore(a, b) {
  const one = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const two = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (!one.size || !two.size) return 0;
  return [...one].filter((w) => two.has(w)).length / Math.max(one.size, two.size);
}

export async function findImportedDuplicate(offer) {
  const now = new Date();
  const candidates = await Listing.find({
    section: "imobiliare",
    location: offer.location,
    category: offer.category,
    price: { $gte: offer.price * 0.97, $lte: offer.price * 1.03 },
    visibility: "public",
    status: "disponibil",
    $or: [{ expiresAt: { $gt: now } }, { featuredUntil: { $gt: now } }],
  }).select("_id title description phone images importSourceUrl").limit(150).lean();

  const sameSource = candidates.find((item) => item.importSourceUrl && item.importSourceUrl === offer.sourceUrl);
  if (sameSource) return sameSource;
  return candidates.find((item) => {
    const titleMatch = wordScore(offer.title, item.title);
    const descMatch = wordScore(offer.description, item.description);
    const samePhoto = offer.images.some((url) => (item.images || []).includes(url));
    const samePhone = offer.phone === item.phone;
    return (
      (samePhoto && titleMatch >= 0.6) ||
      (samePhone && titleMatch >= 0.86 && descMatch >= 0.65) ||
      (titleMatch >= 0.94 && descMatch >= 0.94)
    );
  }) || null;
}

async function notifyNewImportedListing(listing, sourceId) {
  try {
    const clean = (value) => String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
    await sendEmail({
      to: process.env.ADMIN_EMAIL || "oltenitaimobiliare@gmail.com",
      subject: "Anunț importat automat — județul Călărași",
      html: "<p>Anunț nou autorizat, sursa: " + clean(sourceId) +
        "</p><p>" + clean(listing.title) + " – " + clean(listing.location) +
        "</p><p>https://oltenitaimobiliare.ro/anunt/" + listing._id + "</p>",
    });
  } catch (error) {
    console.error("Email import (necritic):", error.message);
  }
}

async function acquireLease(now) {
  const owner = crypto.randomUUID();
  const lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
  try {
    const lease = await ImportLease.findOneAndUpdate(
      {
        _id: "authorized-auto-import",
        $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }],
      },
      { $set: { owner, lockedUntil } },
      { upsert: true, new: true }
    );
    return lease?.owner === owner ? owner : null;
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

export async function publishAuthorizedOffers({ now = new Date() } = {}) {
  if (process.env.AUTOPUBLISH_ENABLED !== "true") return { status: "disabled", published: 0 };
  const owner = await acquireLease(now);
  if (!owner) return { status: "busy", published: 0 };
  try {
    const day = localDayKey(now);
    const already = await Listing.countDocuments({ importedDay: day });
    let slots = Math.max(0, MAX_PER_DAY - already);
    let published = 0;
    let duplicates = 0;
    let invalid = 0;
    if (!slots) return { status: "daily_limit", day, published: 0 };

    const queued = await ImportOffer.find({
      status: "queued",
      lastSeenAt: { $gte: new Date(now.getTime() - 7 * 86400000) },
    }).sort({ createdAt: 1 }).limit(50);

    for (const offer of queued) {
      if (!slots) break;
      const checked = validateImportedOffer({
        ...offer.toObject(), locality: offer.location, available: offer.available,
      });
      if (!checked.ok) {
        offer.status = "invalid";
        offer.lastError = checked.error;
        await offer.save();
        invalid++;
        continue;
      }
      const value = checked.value;
      const exists = await Listing.findOne({
        importSourceId: offer.sourceId, importExternalId: offer.externalId,
      }).select("_id").lean();
      if (exists) {
        offer.status = "published";
        offer.listing = exists._id;
        await offer.save();
        continue;
      }

      const duplicate = await findImportedDuplicate(value);
      if (duplicate) {
        offer.status = "duplicate";
        offer.lastError = "Oferta este deja prezentă în baza de date";
        await offer.save();
        duplicates++;
        continue;
      }
      let listing;
      try {
        listing = await Listing.create({
          title: value.title, description: value.description,
          category: value.category, location: value.location,
          price: value.price, phone: value.phone, email: value.email,
          images: value.images, imageUrl: value.images[0], intent: value.intent,
          dealType: value.intent === "inchiriez" ? "inchiriere" : "vanzare",
          section: "imobiliare", visibility: "public", status: "disponibil",
          featured: false, isFree: true, rezervat: false, vandut: false,
          // Durata specială a importurilor nu schimbă regula gratuită a utilizatorilor.
          expiresAt: new Date(now.getTime() + 30 * 86400000),
          importSourceId: offer.sourceId, importExternalId: offer.externalId,
          importSourceUrl: value.sourceUrl, importConsentReference: value.consentReference,
          importedAt: now, importedDay: day,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        // Reîncercarea după un restart nu poate duplica aceeași sursă/ofertă.
        listing = await Listing.findOne({
          importSourceId: offer.sourceId, importExternalId: offer.externalId,
        }).lean();
        if (!listing) throw error;
      }
      offer.status = "published";
      offer.listing = listing._id;
      offer.lastError = "";
      await offer.save();
      slots--;
      published++;
      await notifyNewImportedListing(listing, offer.sourceId);
    }
    return { status: "ok", day, published, duplicates, invalid, remaining: slots };
  } finally {
    await ImportLease.updateOne(
      { _id: "authorized-auto-import", owner },
      { $set: { lockedUntil: new Date(0), owner: "" } }
    );
  }
}
