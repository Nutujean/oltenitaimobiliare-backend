/* =======================================================
   ✅ SERVER FINAL — API Oltenița Imobiliare
======================================================= */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import https from "https";
import Listing from "./models/Listing.js";

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

/* =======================================================
   🌐 CORS + BODY PARSERS
======================================================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 📄 robots.txt – permitem toți botii, inclusiv Facebook
app.get("/robots.txt", (req, res) => {
  res
    .type("text/plain")
    .send(
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
}, 2 * 60 * 1000);

/* =======================================================
   🚀 START SERVER
======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server pornit pe portul ${PORT}`)
);
