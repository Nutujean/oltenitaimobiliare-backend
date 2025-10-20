// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import fetch from "node-fetch"; // pentru proxy imagine
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
   🟦 Ruta unică de SHARE pentru Facebook (OG + redirect)
======================================================= */
app.get("/share/:id", async (req, res) => {
  try {
    console.log("📣 Generare pagină SHARE pentru ID:", req.params.id);

    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) {
      return res.status(404).send("<h1>Anunțul nu a fost găsit</h1>");
    }

    // Imagine principală
    let image = listing.images?.[0] || listing.imageUrl || "";
    if (image && image.includes("cloudinary.com")) {
      image = image.replace(
        "/upload/",
        "/upload/f_jpg,q_auto,w_1200,h_630,c_fill/"
      );
    }
    if (!image) {
      image =
        "https://res.cloudinary.com/oltenitaimobiliare/image/upload/f_jpg,q_auto,w_1200,h_630,c_fill/v1739912345/oltenita_fallback.jpg";
    }

    const title = listing.title || "Anunț imobiliar din Oltenița";
    const desc =
      listing.description?.substring(0, 160) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița și împrejurimi.";
    const redirectUrl = `https://oltenitaimobiliare.ro/anunt/${listing._id}?utm=facebook`;

    // HTML OG + redirect
    const html = `
      <!DOCTYPE html>
      <html lang="ro">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${title}</title>
          <link rel="canonical" href="${redirectUrl}" />

          <!-- ✅ Open Graph -->
          <meta property="og:type" content="article" />
          <meta property="og:site_name" content="Oltenița Imobiliare" />
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${desc}" />
          <meta property="og:url" content="${redirectUrl}" />
          <meta property="og:image" content="${image}?v=2" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:type" content="image/jpeg" />
          <meta property="og:locale" content="ro_RO" />

          <!-- ✅ Twitter -->
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${title}" />
          <meta name="twitter:description" content="${desc}" />
          <meta name="twitter:image" content="${image}" />

          <meta http-equiv="refresh" content="1; url=${redirectUrl}" />
        </head>
        <body style="font-family:sans-serif;text-align:center;margin-top:60px;">
          <h2 style="color:#0a58ca;">${title}</h2>
          <p style="max-width:600px;margin:10px auto;">${desc}</p>
          <p>
            <a href="${redirectUrl}" style="color:#0a58ca;font-weight:bold;text-decoration:none;">
              👉 Vezi anunțul complet pe Oltenița Imobiliare
            </a>
          </p>
        </body>
      </html>
    `;

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("❌ Eroare la generarea paginii de share:", err);
    res.status(500).send("Eroare internă server");
  }
});

/* =======================================================
   🖼️ Proxy imagine pentru Facebook (forțare JPEG)
======================================================= */
app.get(["/proxy-image", "/proxy-image.jpg"], async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Lipsește URL-ul imaginii");

    const response = await fetch(imageUrl);
    if (!response.ok) return res.status(404).send("Imagine negăsită");

    const buffer = await response.arrayBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("❌ Eroare proxy imagine:", err);
    res.status(500).send("Eroare proxy imagine");
  }
});

/* =======================================================
   🕒 CRON zilnic pentru dezactivarea automată a anunțurilor expirate
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
/* =======================================================
   🟢 Keep-alive intern (ping automat la backend)
======================================================= */
import https from "https";

setInterval(() => {
  const url = "https://oltenitaimobiliare-backend.onrender.com/api/health";
  https
    .get(url, (res) => {
      console.log(`🔁 Keep-alive ping -> ${res.statusCode}`);
    })
    .on("error", (err) => {
      console.error("❌ Keep-alive error:", err.message);
    });
}, 4 * 60 * 1000); // la fiecare 4 minute
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
