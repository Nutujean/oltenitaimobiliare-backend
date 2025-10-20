// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import fetch from "node-fetch";
import https from "https";
import Listing from "./models/Listing.js";

// 🔹 Rute existente
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";

dotenv.config();
mongoose.set("autoIndex", process.env.NODE_ENV !== "production");

const app = express();

/* ---------------- CORS ---------------- */
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(
  cors({
    origin: (_origin, cb) => cb(null, true),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ---------------- Parsere ---------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- DB ---------------- */
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/oltenitaimobiliare";

console.log("ℹ️  Încerc conexiunea la MongoDB...");
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err);
    process.exit(1);
  });

/* ---------------- Health ---------------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ---------------- Rute API ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/contact", contactRoutes);

console.log("✔ Rute Stripe + Listings montate");

/* =======================================================
   🟦 Distribuire Facebook (Open Graph + redirect curat)
======================================================= */
app.get("/share/:id", async (req, res) => {
  try {
    console.log("📣 Generare pagină SHARE pentru ID:", req.params.id);

    const ua = req.headers["user-agent"] || "";
    const isBot = /facebookexternalhit|Twitterbot|Slackbot|WhatsApp/i.test(ua);
    console.log("👁️ User-Agent:", ua);

    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) {
      return res.status(404).send("<h1>Anunțul nu a fost găsit</h1>");
    }

    let image = listing.images?.[0] || listing.imageUrl || "";
    if (image.includes("cloudinary.com")) {
      image = image.replace(
        "/upload/",
        "/upload/f_jpg,q_auto,w_1200,h_630,c_fill/"
      );
    } else if (!image) {
      image =
        "https://res.cloudinary.com/dql90lxy5/image/upload/f_jpg,q_auto,w_1200,h_630,c_fill/v1759264353/e3rkobxfqobzohrme4tu.jpg";
    }

    const title = listing.title || "Anunț imobiliar în Oltenița";
    const desc =
      listing.description?.substring(0, 160) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița și împrejurimi.";
    const redirectUrl = `https://oltenitaimobiliare.ro/anunt/${listing._id}`;

    // 🧠 Dacă e bot (Facebook, Twitter, WhatsApp etc.) → servim doar meta OG static
    if (isBot) {
      console.log("🤖 Crawler detectat, servim OG tags fără redirect.");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!DOCTYPE html>
        <html lang="ro">
        <head>
          <meta charset="utf-8" />
          <meta property="og:image" content="https://share.oltenitaimobiliare.ro/proxy-image.jpg?url=${encodeURIComponent(
            image
          )}&v=6" />
          <meta property="og:image:secure_url" content="https://share.oltenitaimobiliare.ro/proxy-image.jpg?url=${encodeURIComponent(
            image
          )}&v=6" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:type" content="image/jpeg" />
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${desc}" />
          <meta property="og:url" content="${redirectUrl}" />
          <meta property="og:site_name" content="Oltenița Imobiliare" />
          <meta property="og:type" content="article" />
          <meta property="og:locale" content="ro_RO" />
        </head>
        <body></body></html>`);
    }

    // 🧍‍ Vizitator uman → pagina normală cu redirect
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
      <html lang="ro">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title}</title>
          <meta property="og:image" content="https://share.oltenitaimobiliare.ro/proxy-image.jpg?url=${encodeURIComponent(
            image
          )}&v=6" />
          <meta property="og:image:secure_url" content="https://share.oltenitaimobiliare.ro/proxy-image.jpg?url=${encodeURIComponent(
            image
          )}&v=6" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:type" content="image/jpeg" />
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${desc}" />
          <meta property="og:url" content="${redirectUrl}" />
          <meta property="og:site_name" content="Oltenița Imobiliare" />
          <meta property="og:type" content="article" />
          <meta property="og:locale" content="ro_RO" />
          <meta http-equiv="refresh" content="1; url=${redirectUrl}" />
        </head>
        <body style="font-family:sans-serif;text-align:center;margin-top:50px;">
          <h2>${title}</h2>
          <p>${desc}</p>
          <a href="${redirectUrl}">👉 Vezi anunțul complet pe Oltenița Imobiliare</a>
        </body>
      </html>`);
  } catch (err) {
    console.error("❌ Eroare la /share:", err);
    res.status(500).send("Eroare internă server");
  }
});

/* =======================================================
   🖼️ Proxy imagine pentru Facebook (forțare JPEG)
======================================================= */
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
app.get(["/proxy-image", "/proxy-image.jpg"], async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      console.warn("⚠️ Lipsă parametru ?url=");
      return res.status(400).send("Lipsește URL-ul imaginii");
    }

    const cleanUrl = decodeURIComponent(imageUrl).replace(/^http:\/\//, "https://");
    console.log("🌍 Proxy fetch către:", cleanUrl);

    const response = await fetch(cleanUrl, {
      agent: httpsAgent,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://share.oltenitaimobiliare.ro/",
      },
    });

    console.log("📥 Răspuns Cloudinary:", response.status, response.statusText);

    if (!response.ok) {
      return res.status(404).send("Imagine negăsită");
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Eroare proxy imagine:", err);
    res.status(500).send("Eroare proxy imagine");
  }
});

/* =======================================================
   🕒 CRON zilnic pentru expirare automată
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
    if (expiredFree.modifiedCount > 0 || expiredFeatured.modifiedCount > 0) {
      console.log(
        `🕒 [CRON] Dezactivate: ${
          expiredFree.modifiedCount + expiredFeatured.modifiedCount
        } anunțuri expirate.`
      );
    }
  } catch (err) {
    console.error("❌ Eroare CRON:", err);
  }
});

/* ---------------- 404 API ---------------- */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});

/* =======================================================
   🟢 Keep-alive intern
======================================================= */
setInterval(async () => {
  try {
    const url = "https://oltenitaimobiliare-backend.onrender.com/api/health";
    https.get(url, (res) => {
      console.log(`🔁 Keep-alive ping -> ${res.statusCode}`);
    }).on("error", (err) => {
      console.error("❌ Keep-alive error:", err.message);
    });
  } catch (err) {
    console.error("❌ Eroare la keep-alive:", err.message);
  }
}, 4 * 60 * 1000);
