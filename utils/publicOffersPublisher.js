import crypto from "node:crypto";
import ExternalOffer from "../models/ExternalOffer.js";
import ImportLease from "../models/ImportLease.js";
import Listing from "../models/Listing.js";
import { PUBLIC_OFFER_FEEDS, normalizeRssOffer, parsePropertyRss, isExcludedExternalSource } from "./publicOfferFeed.js";
import { localDayKey } from "./authorizedPublisher.js";
import { parseAnuntulIndex } from "./anuntulIndex.js";

const DAY = 86400000;
const DAILY_MAX = 2;
const FEED_TIMEOUT = 20000;
const MAX_BYTES = 1500000;

function keyWords(value) {
  return new Set(String(value || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter((w) => w.length > 2));
}
function overlap(a, b) {
  const first = keyWords(a), second = keyWords(b);
  if (!first.size || !second.size) return 0;
  return [...first].filter((word) => second.has(word)).length / Math.max(first.size, second.size);
}

async function duplicatesUserListing(offer, now) {
  const candidates = await Listing.find({
    location: offer.locality, category: offer.category, section: "imobiliare",
    visibility: "public", status: "disponibil",
    $or: [{ expiresAt: { $gte: now } }, { featuredUntil: { $gte: now } }],
  }).select("title price").lean().limit(120);
  return candidates.some((item) =>
    overlap(item.title, offer.title) >= 0.85 &&
    (offer.priceEUR === null || !item.price ||
      Math.abs(item.price - offer.priceEUR) / offer.priceEUR <= 0.05)
  );
}

async function getFeed(source, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT);
  try {
    const response = await fetchImpl(source.feedUrl, {
      headers: { "Accept": source.type === "html" ? "text/html" : "application/rss+xml, application/xml;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; OltenitaImobiliare-LinkDirectory/1.0; +https://oltenitaimobiliare.ro/)" },
      signal: controller.signal, redirect: "follow",
    });
    if (!response.ok || new URL(response.url).origin !== source.origin) {
      throw new Error("Sursa inaccesibilă sau redirecționare externă");
    }
    if (Number(response.headers.get("content-length") || 0) > MAX_BYTES) {
      throw new Error("RSS prea mare");
    }
    const xml = await response.text();
    if (Buffer.byteLength(xml, "utf8") > MAX_BYTES) throw new Error("RSS prea mare");
    return source.type === "html" ? parseAnuntulIndex(xml, source) : parsePropertyRss(xml);
  } finally {
    clearTimeout(timeout);
  }
}

async function lease(now) {
  const owner = crypto.randomUUID();
  try {
    const record = await ImportLease.findOneAndUpdate({
      _id: "external-public-rss", $or: [
        { lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } },
      ],
    }, { $set: { owner, lockedUntil: new Date(now.getTime() + 5 * 60000) } },
    { upsert: true, new: true });
    return record?.owner === owner ? owner : null;
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

export async function publishPublicOfferReferences({ fetchImpl = fetch, now = new Date() } = {}) {
  if (process.env.PUBLIC_OFFERS_ENABLED === "false") return { status: "disabled", published: 0 };
  const eligibleSources = PUBLIC_OFFER_FEEDS.filter((source) => !isExcludedExternalSource(source.feedUrl, source.name));
  if (!eligibleSources.length) return { status: "unconfigured", published: 0 };
  const owner = await lease(now);
  if (!owner) return { status: "busy", published: 0 };
  const day = localDayKey(now);
  const result = { status: "ok", day, published: 0, skipped: 0, errors: 0 };
  try {
    let available = Math.max(0, DAILY_MAX - await ExternalOffer.countDocuments({ publishedDay: day }));
    if (!available) return { ...result, status: "daily_limit" };
    for (const source of eligibleSources) {
      if (!available) break;
      let items;
      try {
        items = await getFeed(source, fetchImpl);
      } catch (error) {
        console.error("RSS oferte externe (" + source.id + "):", error.message);
        result.errors++;
        continue;
      }
      const eligible = (source.type === "html" ? items : items.map((item) => normalizeRssOffer(item, source, now)))
        .filter(Boolean).sort((a, b) => b.sourcePublishedAt - a.sourcePublishedAt);
      for (const offer of eligible) {
        if (!available) break;
        if (await ExternalOffer.exists({ sourceUrl: offer.sourceUrl })) {
          result.skipped++;
          continue;
        }
        if (await duplicatesUserListing(offer, now)) {
          result.skipped++;
          continue;
        }
        const expiresAt = new Date(Math.min(
          now.getTime() + 30 * DAY, offer.sourcePublishedAt.getTime() + 120 * DAY
        ));
        if (expiresAt <= now) continue;
        try {
          await ExternalOffer.create({ ...offer, expiresAt, publishedDay: day, active: true });
          result.published++;
          available--;
        } catch (err) {
          if (err.code !== 11000) throw err;
          result.skipped++;
        }
      }
    }
    return result;
  } finally {
    await ImportLease.updateOne(
      { _id: "external-public-rss", owner },
      { $set: { lockedUntil: new Date(0), owner: "" } }
    );
  }
}
