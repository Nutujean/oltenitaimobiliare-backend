
/* =======================================================
   ✅ SERVER FINAL — API Oltenița Imobiliare
======================================================= */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import https from "https";
import crypto from "crypto";
import Listing from "./models/Listing.js";
import ListingView from "./models/ListingView.js";
import ListingViewEvent from "./models/ListingViewEvent.js";
import { protect } from "./middleware/authMiddleware.js";
import { sendListingNotificationSMS } from "./utils/smsLink.js";

// 🔹 Import rute
import phoneAuthRoutes from "./routes/phoneAuth.js";
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import shareRoutes from "./routes/shareRoute.js";      // 👈 SHARE
import sitemapRoute from "./routes/sitemapRoutes.js";
import anunturileMeleRoute from "./routes/anunturileMele.js";

dotenv.config();
const app = express();
app.set("trust proxy", 1);

const VIEW_SMS_THRESHOLDS = [100, 250, 500, 1000];

function normalizeSmsPhone(value = "") {
  return String(value).replace(/\D/g, "").replace(/^4/, "");
}

function shortTitle(title = "") {
  const clean = String(title || "anuntul tau").trim();
  return clean.length > 42 ? `${clean.slice(0, 39)}...` : clean;
}

function getInterestLevel(weeklyViews = 0) {
  if (weeklyViews >= 50) return "ridicat";
  if (weeklyViews >= 15) return "bun";
  return "scazut";
}

async function maybeSendViewMilestoneSms(listing) {
  try {
    if (!listing?.phone) return;

    const views = Number(listing.views || 0);
    const alreadySent = Array.isArray(listing.viewMilestoneSmsSent)
      ? listing.viewMilestoneSmsSent
      : [];

    const milestone = VIEW_SMS_THRESHOLDS.find(
      (t) => views >= t && !alreadySent.includes(t)
    );

    if (!milestone) return;

    const phone = normalizeSmsPhone(listing.phone);
    if (!/^07\d{8}$/.test(phone)) return;

    const message =
      milestone >= 1000
        ? "OltenitaImobiliare.ro: Felicitari! Anuntul tau a depasit 1000 de vizualizari. Intra in cont pentru statistici complete."
        : `OltenitaImobiliare.ro: Anuntul tau a depasit ${milestone} de vizualizari. Intra in cont pentru statistici complete.`;

    const sms = await sendListingNotificationSMS(phone, message);

    if (sms.success) {
      await Listing.updateOne(
        { _id: listing._id },
        { $addToSet: { viewMilestoneSmsSent: milestone } }
      );
      console.log(`📩 SMS prag ${milestone} trimis pentru anunț ${listing._id}`);
    }
  } catch (err) {
    console.error("❌ Eroare SMS prag vizualizări:", err?.message || err);
  }
}

/* =======================================================
   🌐 CORS + BODY PARSERS
======================================================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =======================================================
   🔍 HEALTH & PING — o singură dată
======================================================= */
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, from: "server.js", time: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend funcționează normal ✅" });
});

/* =======================================================
   📦 CONEXIUNE MONGO
======================================================= */
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/oltenitaimobiliare";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err);
    process.exit(1);
  });

/* =======================================================
   📄 robots.txt — permitem Facebook & toți botii
======================================================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "",
      "User-agent: facebookexternalhit",
      "Allow: /",
    ].join("\n")
  );
});

/* =======================================================
   🧩 RUTE — ÎN ORDINE
======================================================= */
console.log("🟢 Încep montarea rutelor Express...");

// 🏡 RUTE SHARE — foarte important să fie devreme
app.use("/", shareRoutes); // 👈 Aici vine /share/:id și /fb/:id

/* =======================================================
   👁️ COUNTING VIZUALIZĂRI ANUNȚURI
   - 1 vizualizare / anunț / vizitator / 24h
   - istoric separat pentru statistica ultimelor 7 zile
   - SMS automat la 100 / 250 / 500 / 1000 vizualizări
======================================================= */
app.post("/api/listings/:id/view", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID invalid." });
    }

    const listingExists = await Listing.exists({ _id: id });
    if (!listingExists) {
      return res.status(404).json({ ok: false, error: "Anunțul nu a fost găsit." });
    }

    const forwardedFor = String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    const ip = forwardedFor || req.ip || req.socket?.remoteAddress || "unknown-ip";
    const userAgent = String(req.headers["user-agent"] || "unknown-agent");

    const visitorKey = crypto
      .createHash("sha256")
      .update(`${ip}|${userAgent}`)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let counted = false;

    try {
      await ListingView.create({
        listing: id,
        visitorKey,
        expiresAt,
      });

      counted = true;
    } catch (err) {
      if (err?.code !== 11000) {
        throw err;
      }
    }

    let listing;

    if (counted) {
      await ListingViewEvent.create({
        listing: id,
        viewedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      listing = await Listing.findByIdAndUpdate(
        id,
        { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } },
        { new: true }
      )
        .select("title phone views lastViewedAt viewMilestoneSmsSent")
        .lean();

      await maybeSendViewMilestoneSms(listing);
    } else {
      listing = await Listing.findById(id).select("views lastViewedAt").lean();
    }

    return res.json({
      ok: true,
      counted,
      views: listing?.views || 0,
      lastViewedAt: listing?.lastViewedAt || null,
    });
  } catch (err) {
    console.error("❌ Eroare POST /api/listings/:id/view:", err);
    return res.status(500).json({ ok: false, error: "Eroare server la contorizarea vizualizării." });
  }
});

/* =======================================================
   📊 Anunțurile mele + statistici profesionale
======================================================= */
app.get("/api/listings/mine-stats", protect, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const ids = listings.map((l) => l._id).filter(Boolean);
    const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyCounts = ids.length
      ? await ListingViewEvent.aggregate([
          { $match: { listing: { $in: ids }, viewedAt: { $gte: since7Days } } },
          { $group: { _id: "$listing", count: { $sum: 1 } } },
        ])
      : [];

    const weeklyMap = new Map(weeklyCounts.map((row) => [String(row._id), row.count]));

    const enriched = listings.map((listing) => {
      const weeklyViews = weeklyMap.get(String(listing._id)) || 0;
      const expiresAt = listing.expiresAt ? new Date(listing.expiresAt) : null;
      const daysUntilExpire = expiresAt
        ? Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...listing,
        weeklyViews,
        interestLevel: getInterestLevel(weeklyViews),
        daysUntilExpire,
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error("❌ Eroare GET /api/listings/mine-stats:", err);
    return res.status(500).json({ error: "Eroare server la încărcarea statisticilor." });
  }
});

// Rute API

app.use("/api/phone", phoneAuthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api", anunturileMeleRoute);
app.use("/api/stripe", stripeRoutes);
app.use("/api/contact", contactRoutes);

// Sitemap / alte rute publice
app.use("/", sitemapRoute);

// Root simplu
app.get("/", (req, res) => {
  res.json({
    message: "Oltenita Imobiliare API activ ✅",
    time: new Date().toISOString(),
  });
});
/* =======================================================
   🔐 ADMIN — PROMOVARE GRATUITĂ (fără Stripe)
   Header: x-admin-key: <ADMIN_KEY din .env>
   Body: { "days": 7 }  (sau 14 / 30)
======================================================= */
app.post("/api/admin/promote/:id", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!process.env.ADMIN_KEY) {
      return res.status(500).json({ ok: false, error: "ADMIN_KEY lipsă pe server." });
    }

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ ok: false, error: "Acces interzis (nu ești admin)." });
    }

    const { id } = req.params;
    const daysRaw = req.body?.days ?? 30; // default 30 zile
    const days = Math.max(1, Math.min(365, Number(daysRaw) || 30)); // 1..365

    const featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const updated = await Listing.findByIdAndUpdate(
  id,
  {
    $set: {
      featured: true,
      featuredUntil,
      status: "disponibil",
      visibility: "public",
      isFree: false,
      expiresAt: featuredUntil,
    },
  },
  { new: true }
);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Anunțul nu există." });
    }

    return res.json({
      ok: true,
      message: `Anunț promovat gratuit (admin) pentru ${days} zile.`,
      featuredUntil: updated.featuredUntil,
      listingId: updated._id,
    });
  } catch (err) {
    console.error("❌ ADMIN PROMOTE ERROR:", err);
    return res.status(500).json({ ok: false, error: "Eroare server." });
  }
});

console.log("✔ Toate rutele Express au fost montate corect.");

/* =======================================================
   🚫 Fallback 404 — ULTIMUL
======================================================= */
app.use((req, res) => {
  console.warn("⚠️ Ruta necunoscută:", req.originalUrl);
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

/* =======================================================
   🕒 CRON — EXPIRARE, ȘTERGERE & SMS EXPIRARE
   - SMS cu 2 zile înainte de expirare
   - SMS în ziua expirării
   - expiră după expiresAt
   - șterge expiratele la 180 zile DUPĂ expirare
======================================================= */
cron.schedule("0 3 * * *", async () => {
  try {
    const now = new Date();
    const in2DaysStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    in2DaysStart.setHours(0, 0, 0, 0);
    const in2DaysEnd = new Date(in2DaysStart);
    in2DaysEnd.setHours(23, 59, 59, 999);

    // 0) SMS cu 2 zile înainte de expirare
    const expiringSoon = await Listing.find({
      visibility: "public",
      status: "disponibil",
      expiresAt: { $gte: in2DaysStart, $lte: in2DaysEnd },
      expireSms2DaysSentAt: null,
      $or: [{ featuredUntil: null }, { featuredUntil: { $lt: now } }],
    })
      .select("title phone")
      .lean();

    for (const listing of expiringSoon) {
      const phone = normalizeSmsPhone(listing.phone);
      if (!/^07\d{8}$/.test(phone)) continue;

      const sms = await sendListingNotificationSMS(
        phone,
        `OltenitaImobiliare.ro: Anuntul "${shortTitle(listing.title)}" expira in 2 zile. Promoveaza-l din cont pentru a ramane activ si vizibil.`
      );

      if (sms.success) {
        await Listing.updateOne(
          { _id: listing._id, expireSms2DaysSentAt: null },
          { $set: { expireSms2DaysSentAt: new Date() } }
        );
      }
    }

    // 1) EXPIRĂ (doar dacă NU e promovat activ)
    const toExpire = await Listing.find({
      status: "disponibil",
      expiresAt: { $lt: now },
      $or: [{ featuredUntil: null }, { featuredUntil: { $lt: now } }],
    })
      .select("title phone expireSmsExpiredSentAt")
      .lean();

    for (const listing of toExpire) {
      if (listing.expireSmsExpiredSentAt) continue;

      const phone = normalizeSmsPhone(listing.phone);
      if (!/^07\d{8}$/.test(phone)) continue;

      const sms = await sendListingNotificationSMS(
        phone,
        `OltenitaImobiliare.ro: Anuntul "${shortTitle(listing.title)}" a expirat. Il poti reactiva prin promovare direct din contul tau.`
      );

      if (sms.success) {
        await Listing.updateOne(
          { _id: listing._id, expireSmsExpiredSentAt: null },
          { $set: { expireSmsExpiredSentAt: new Date() } }
        );
      }
    }

    const expired = await Listing.updateMany(
      {
        status: "disponibil",
        expiresAt: { $lt: now },
        $or: [{ featuredUntil: null }, { featuredUntil: { $lt: now } }],
      },
      { $set: { status: "expirat" } }
    );

    // 2) ȘTERGE DOAR EXPIRATELE vechi de 180 zile de la expiresAt
    const deleteExpiredBefore = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const deleted = await Listing.deleteMany({
      status: "expirat",
      expiresAt: { $lt: deleteExpiredBefore },
      $or: [{ featuredUntil: null }, { featuredUntil: { $lt: now } }],
    });

    if (expired.modifiedCount || deleted.deletedCount || expiringSoon.length || toExpire.length) {
      console.log(
        `🧹 CRON OK → SMS -2 zile: ${expiringSoon.length}, SMS expirare: ${toExpire.length}, Expirate: ${expired.modifiedCount}, Șterse: ${deleted.deletedCount}`
      );
    }
  } catch (err) {
    console.error("❌ Eroare CRON anunțuri:", err);
  }
});

/* =======================================================
   🔁 KEEP-ALIVE RENDER
======================================================= */
setInterval(() => {
  const url = "https://api.oltenitaimobiliare.ro/api/health";
  https
    .get(url, (res) => console.log(`🔁 Keep-alive ping -> ${res.statusCode}`))
    .on("error", (err) => console.error("❌ Keep-alive error:", err.message));
}, 2 * 60 * 1000);

/* =======================================================
   🚀 START SERVER
======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server pornit pe portul ${PORT}`)
);
