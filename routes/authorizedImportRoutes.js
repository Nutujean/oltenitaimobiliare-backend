import express from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import ImportOffer from "../models/ImportOffer.js";
import Listing from "../models/Listing.js";
import { validateImportedOffer } from "../utils/importValidation.js";
import { localDayKey, publishAuthorizedOffers } from "../utils/authorizedPublisher.js";

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60000, limit: 50, standardHeaders: "draft-7", legacyHeaders: false });

function secureEquals(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sourceSecrets() {
  try {
    const mapping = JSON.parse(process.env.AUTHORIZED_IMPORT_SOURCES_JSON || "{}");
    return mapping && !Array.isArray(mapping) && typeof mapping === "object" ? mapping : {};
  } catch {
    return {};
  }
}

function checkPartner(req, res, next) {
  const sourceId = String(req.params.sourceId || "");
  if (!/^[a-zA-Z0-9_-]{3,60}$/.test(sourceId)) return res.status(400).json({ error: "Sursă invalidă" });
  const expected = sourceSecrets()[sourceId];
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (typeof expected !== "string" || expected.length < 32 || !secureEquals(provided, expected)) {
    return res.status(403).json({ error: "Sursă neautorizată" });
  }
  next();
}

function checkAdmin(req, res, next) {
  if (!process.env.ADMIN_KEY || !secureEquals(req.headers["x-admin-key"], process.env.ADMIN_KEY)) {
    return res.status(403).json({ error: "Acces interzis" });
  }
  next();
}

// Partenerii autorizați ne trimit oferte proprii; nu există scraping de pe alte platforme.
router.post("/sources/:sourceId/offers", limiter, checkPartner, async (req, res) => {
  const items = req.body?.offers;
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    return res.status(400).json({ error: "offers trebuie să conțină 1–100 de oferte" });
  }
  const sourceId = req.params.sourceId;
  const result = { queued: 0, updated: 0, withdrawn: 0, rejected: [] };
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const externalId = String(raw?.externalId || "").trim();
    if (!externalId || externalId.length > 160) {
      result.rejected.push({ index: i, error: "externalId invalid" });
      continue;
    }
    try {
      // Revocare explicită / vândut / indisponibil – retragere imediată.
      if (raw.available === false || raw.rightsGranted === false) {
        const offer = await ImportOffer.findOneAndUpdate(
          { sourceId, externalId },
          { $set: { status: "withdrawn", available: false, rightsGranted: false, lastSeenAt: new Date() } },
          { new: true }
        );
        if (offer?.listing) {
          await Listing.updateOne(
            { _id: offer.listing, importSourceId: sourceId, importExternalId: externalId },
            { $set: { visibility: "draft", status: "expirat" } }
          );
        }
        result.withdrawn++;
        continue;
      }

      const checked = validateImportedOffer(raw);
      if (!checked.ok) {
        result.rejected.push({ index: i, externalId, error: checked.error });
        continue;
      }
      const existing = await ImportOffer.findOne({ sourceId, externalId }).select("status listing");
      // Nu republicăm automat ofertele deja publicate/retrase.
      if (existing?.status === "published" || existing?.status === "withdrawn") {
        result.updated++;
        continue;
      }
      await ImportOffer.findOneAndUpdate(
        { sourceId, externalId },
        { $set: { ...checked.value, sourceId, status: "queued", lastSeenAt: new Date(), lastError: "" } },
        { upsert: true, new: true, runValidators: true }
      );
      result.queued++;
    } catch (error) {
      if (error.code === 11000) {
        result.updated++;
      } else {
        console.error("Eroare ingestie ofertă:", error.message);
        result.rejected.push({ index: i, externalId, error: "Eroare de procesare" });
      }
    }
  }
  return res.json({ ok: true, sourceId, ...result });
});

router.get("/status", checkAdmin, async (_req, res) => {
  const day = localDayKey();
  const [publishedToday, pending, publishedTotal] = await Promise.all([
    Listing.countDocuments({ importedDay: day }),
    ImportOffer.countDocuments({ status: "queued" }),
    ImportOffer.countDocuments({ status: "published" }),
  ]);
  res.json({
    ok: true, enabled: process.env.AUTOPUBLISH_ENABLED === "true", day,
    publishedToday, dailyLimit: 2, pending, publishedTotal,
    authorizedSources: Object.keys(sourceSecrets()).length,
  });
});

router.post("/run", checkAdmin, async (_req, res) => {
  try {
    return res.json(await publishAuthorizedOffers());
  } catch (error) {
    console.error("Autopublicare:", error);
    return res.status(500).json({ error: "Autopublicarea a eșuat. Verifică logurile." });
  }
});

export default router;
