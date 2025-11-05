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
import shareRoutes from "./routes/shareRoute.js";
import shareFacebookRoute from "./routes/shareFacebookRoute.js";
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

/* =======================================================
   🔍 Test ping — trebuie să meargă mereu
======================================================= */
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, from: "server.js", time: new Date().toISOString() });
});

/* =======================================================
   🧭 REDIRECȚIONARE DOMENIU SHARE → API
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
   🧩 RUTE API — MONTATE ÎN ORDINEA CORECTĂ
======================================================= */
console.log("🟢 Încep montarea rutelor Express...");

app.use("/api/phone", phoneAuthRoutes);
console.log("✅ phoneAuthRoutes montat la /api/phone");

app.use("/api/auth", authRoutes);
console.log("✅ authRoutes montat la /api/auth");

app.use("/api/users", usersRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api", anunturileMeleRoute);
app.use("/api/stripe", stripeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/", shareRoutes);
app.use("/", shareFacebookRoute);
app.use("/", sitemapRoute);
setTimeout(() => {
  console.log("🔍 Rute active înregistrate:");
  app._router.stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      console.log("➡️", layer.route.path);
    } else if (layer.name === "router" && layer.handle.stack) {
      layer.handle.stack.forEach((sub) => {
        if (sub.route && sub.route.path) {
          console.log("➡️", sub.route.path);
        }
      });
    }
  });
}, 2000);


console.log("✔ Toate rutele Express au fost montate corect.");

app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Ruta API inexistentă" });
  res.status(404).send("Not found");
});

/* =======================================================
   🚫 Fallback 404 — trebuie să fie ULTIMUL
======================================================= */
app.use((req, res) => {
  console.warn("⚠️ Ruta necunoscută:", req.originalUrl);
  res.status(404).json({ error: "Ruta API inexistentă" });
});

/* =======================================================
   🧭 HEALTH & PING CHECK
======================================================= */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

app.get("/api/ping", (_req, res) =>
  res.json({ ok: true, endpoint: "/api/ping", time: new Date().toISOString() })
);

/* =======================================================
   🌐 HEALTH + ROOT + 404 HANDLER — ULTIMELE RUTE
======================================================= */

// ✅ Sitemap rămâne activ
app.use("/", sitemapRoute);

// ✅ Health check pentru Render/UptimeRobot
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend funcționează normal ✅" });
});

// ✅ Endpoint simplu pentru rădăcina serverului (evită „ruta necunoscută”)
app.get("/", (req, res) => {
  res.json({
    message: "Oltenita Imobiliare API activ ✅",
    time: new Date().toISOString(),
  });
});

// ✅ Fallback 404 — doar dacă nu s-a potrivit nicio rută
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
