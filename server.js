/* =======================================================
   ✅ SERVER FINAL — API Oltenița Imobiliare (stabil)
======================================================= */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import fetch from "node-fetch";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import Listing from "./models/Listing.js";

// 🔹 Importuri rute
import phoneAuthRoutes from "./routes/phoneAuth.js";
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import shareRoutes from "./routes/shareRoute.js";
import shareFacebookRoute from "./routes/shareFacebookRoute.js";
import sitemapRoute from "./routes/sitemapRoutes.js";

dotenv.config();
const app = express();

/* =======================================================
   🌐 CORS + BODY PARSERS
======================================================= */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =======================================================
   🧭 REDIRECȚIONARE DOMENIU
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
   🧩 RUTE API
======================================================= */
app.use("/api/phone", phoneAuthRoutes); // ✅ SMS Login/Register
console.log("✅ phoneAuthRoutes încărcat corect pe server");

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/", shareRoutes);
app.use("/", shareFacebookRoute);
app.use("/", sitemapRoute);

console.log("✅ authRoutes încărcat corect pe server");
console.log("✅ Toate rutele API montate corect");

/* =======================================================
   🧭 HEALTH CHECK
======================================================= */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

/* =======================================================
   🚫 404 HANDLER
======================================================= */
app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Ruta API inexistentă" });
  res.status(404).send("Not found");
});

/* =======================================================
   🕒 CRON EXPIRARE ANUNȚURI
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
    if (expiredFree.modifiedCount > 0 || expiredFeatured.modifiedCount > 0)
      console.log(
        `🕒 [CRON] Dezactivate: ${
          expiredFree.modifiedCount + expiredFeatured.modifiedCount
        } anunțuri expirate.`
      );
  } catch (err) {
    console.error("❌ Eroare CRON:", err);
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
}, 4 * 60 * 1000);

/* =======================================================
   🚀 START SERVER
======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server pornit pe portul ${PORT}`)
);
