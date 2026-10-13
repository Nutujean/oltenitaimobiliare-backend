import express from "express";
import crypto from "node:crypto";
import ExternalOffer from "../models/ExternalOffer.js";
import { localDayKey } from "../utils/authorizedPublisher.js";
import { publishPublicOfferReferences } from "../utils/publicOffersPublisher.js";

const router = express.Router();
function adminAuthorized(req) {
  const expected = process.env.ADMIN_KEY;
  const received = req.headers["x-admin-key"];
  if (typeof expected !== "string" || !expected ||
    typeof received !== "string") return false;
  const a = Buffer.from(expected), b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.get("/", async (req, res) => {
  try {
    const max = Math.min(40, Math.max(1, Number(req.query.limit) || 6));
    const now = new Date();
    const offers = await ExternalOffer.find({
      active: true, expiresAt: { $gt: now }, county: "Călărași",
    }).select("sourceName sourceUrl sourcePublishedAt title summary locality county category intent priceEUR createdAt")
      .sort({ createdAt: -1 }).limit(max).lean();
    res.set("Cache-Control", "public, max-age=180");
    res.json(offers);
  } catch (error) {
    console.error("Oferte externe / GET:", error);
    res.status(503).json({ error: "Ofertele externe sunt temporar indisponibile." });
  }
});

router.get("/status", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(403).json({ error: "Acces interzis" });
  const day = localDayKey();
  const [total, today] = await Promise.all([
    ExternalOffer.countDocuments({ active: true, expiresAt: { $gt: new Date() } }),
    ExternalOffer.countDocuments({ publishedDay: day }),
  ]);
  res.json({
    ok: true, enabled: process.env.PUBLIC_OFFERS_ENABLED === "true",
    day, today, dailyMax: 2, activeOffers: total,
  });
});

router.post("/run", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(403).json({ error: "Acces interzis" });
  try {
    const result = await publishPublicOfferReferences();
    return res.json(result);
  } catch (error) {
    console.error("Oferte externe / RUN:", error);
    return res.status(500).json({ error: "Importul RSS a eșuat." });
  }
});
export default router;
