import crypto from "crypto";
import Listing from "../models/Listing.js";

export function normalizeListingPhone(value = "") {
  return String(value).replace(/\D/g, "").replace(/^4/, "");
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value = "") {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((word) => word.length >= 3)
  );
}

function similarity(a = "", b = "") {
  const first = words(a);
  const second = words(b);

  if (!first.size || !second.size) return 0;

  let common = 0;
  for (const word of first) {
    if (second.has(word)) common += 1;
  }

  return common / Math.max(first.size, second.size);
}

function closePrice(a, b) {
  const first = Number(a || 0);
  const second = Number(b || 0);
  if (!first || !second) return false;

  const diff = Math.abs(first - second);
  const max = Math.max(first, second);
  return diff / max <= 0.03;
}

// One stable fingerprint per account/property/publishing day.
// A unique MongoDB index makes simultaneous identical POSTs atomic.
export function makeListingCreationFingerprint({
  userId, phone, title, description, price, category, location, intent, section = "imobiliare",
  now = new Date(),
}) {
  const date = new Date(now).toISOString().slice(0, 10);
  const payload = [
    String(userId),
    normalizeListingPhone(phone),
    normalizeText(title),
    normalizeText(description),
    Number(price),
    normalizeText(category),
    normalizeText(location),
    normalizeText(intent),
    normalizeText(section),
    date,
  ];
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function findSimilarActiveListing({
  userId,
  phone,
  title,
  description,
  price,
  category,
  location,
  section = "imobiliare",
}) {
  const cleanPhone = normalizeListingPhone(phone);
  const cleanTitle = String(title || "").trim();
  const cleanDescription = String(description || "").trim();
  const cleanCategory = String(category || "").trim();
  const cleanLocation = String(location || "").trim();
  const cleanSection = String(section || "imobiliare").trim();

  if (!cleanPhone || !cleanTitle || !cleanCategory || !cleanLocation) {
    return null;
  }

  const now = new Date();
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  const candidates = await Listing.find({
    user: userId,
    visibility: "public",
    phone: cleanPhone,
    category: cleanCategory,
    location: cleanLocation,
    section: cleanSection,
    createdAt: { $gte: since },
    $or: [{ expiresAt: { $gt: now } }, { featuredUntil: { $gt: now } }],
  })
    .select("title description price")
    .lean()
    .limit(20)
    .exec();

  for (const item of candidates) {
    const titleScore = similarity(cleanTitle, item.title || "");
    const descriptionScore = similarity(cleanDescription, item.description || "");
    const priceLooksSame = closePrice(price, item.price) || Number(price) === Number(item.price);

    if (titleScore >= 0.75 && descriptionScore >= 0.65 && priceLooksSame) {
      return item;
    }

    if (titleScore >= 0.9 && priceLooksSame) {
      return item;
    }
  }

  return null;
}
