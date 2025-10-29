/* =======================================================
   ✅ SERVER FINAL — API Oltenița Imobiliare (versiune stabilă)
======================================================= */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import https from "https";
import fetch from "node-fetch";
import Listing from "./models/Listing.js";

/* ----------------- ROUTES ----------------- */
import authRoutes from "./routes/authRoutes.js";
import phoneAuthRoutes from "./routes/phoneAuth.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import shareRoutes from "./routes/shareRoute.js";
import shareFacebookRoute from "./routes/shareFacebookRoute.js";
import sitemapRoute from "./routes/sitemapRoutes.js";

/* ----------------- INIT ----------------- */
dotenv.config();
const app = express();

/* =======================================================
   🌐 REDIRECT: share.oltenitaimobiliare.ro → api.oltenitaimobiliare.ro
======================================================= */
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (host.includes("share.oltenitaimobiliare.ro")) {
    const newUrl = `https://api.oltenitaimobiliare.ro${req.originalUrl}`;
    console.log("🔁 Redirect SHARE → API:", newUrl);
    return res.redirect(301, newUrl);
  }
  next();
});

/* =======================================================
   ⚙️ CORS + BODY PARSER
======================================================= */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =======================================================
   💾 MONGODB CONNECTION
======================================================= */
const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/oltenitaimobiliare";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err.message);
    process.exit(1);
  });

/* =======================================================
   🧩 ROUTES MOUNTING
======================================================= */
app.use("/api/phone", phoneAuthRoutes); // ✅ Login/Register prin SMS
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/", shareRoutes);
app.use("/", shareFacebookRoute);
app.use("/", sitemapRoute);

console.log("✔ Toate rutele API montate corect");

/* =======================================================
   🧭 HEALTH CHECK
======================================================= */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

/* =======================================================
   🧪 TEST ROUTE — Confirmare build API
======================================================= */
app.get("/api/test-route", (req, res) => {
  res.json({
    ok: true,
    version: "api-final-v3.0",
    url: req.originalUrl,
    time: new Date().toISOString(),
  });
});

/* =======================================================
   🚫 404 HANDLER
======================================================= */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

/* =======================================================
   🕒 CRON: Expirare automată anunțuri
======================================================= */
cron.schedule("0 2 * * *", async () => {
  try {
    const now = new Date();
    const expiredFree = await Listing.updateMany(
      { isFree: true, expiresAt: { $lt: now }, status: { $ne: "expirat" } },
      { $set: { status: "expirat" } }
    );
    const expiredFeatured = await Listing.updateMany(
      { featuredUntil: { $lt: now }, status: { $ne: "expirat" } },
      { $set: { status: "expirat" } }
    );
    const total = expiredFree.modifiedCount + expiredFeatured.modifiedCount;
    if (total > 0) console.log(`🕒 [CRON] ${total} anunțuri marcate ca expirate.`);
  } catch (err) {
    console.error("❌ Eroare CRON:", err);
  }
});

/* =======================================================
   🔁 KEEP ALIVE — Ping Render (API)
======================================================= */
setInterval(() => {
  https
    .get("https://api.oltenitaimobiliare.ro/api/health", (res) =>
      console.log(`🔁 KeepAlive -> ${res.statusCode}`)
    )
    .on("error", (err) => console.error("❌ KeepAlive error:", err.message));
}, 4 * 60 * 1000);

/* =======================================================
   🚀 START SERVER (compatibil Render)
======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server pornit și ascultă pe portul ${PORT}`);
});
