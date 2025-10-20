// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
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
    console.log("🔗 Cerere share pentru ID:", req.params.id);

    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) {
      console.warn("⚠️ Anunț negăsit:", req.params.id);
      return res
        .status(404)
        .send("<h1>Anunțul nu a fost găsit</h1><p>Oltenița Imobiliare</p>");
    }

    // 🖼️ Imagine principală (Cloudinary sau fallback)
    let image = listing.images?.[0] || listing.imageUrl || "";

    // 🧠 Dacă e imagine Cloudinary, curățăm și forțăm format JPEG (Facebook nu acceptă WebP)
    if (image && image.includes("cloudinary.com")) {
      image = image.split("?")[0].replace("http://", "https://");

      // Cloudinary: convertim orice imagine (webp, avif etc.) în JPG
      if (image.includes("/upload/")) {
        image = image.replace("/upload/", "/upload/f_jpg,q_auto/");
      }
    }

    // 🩶 Dacă nu există imagine validă, folosim fallback Cloudinary JPEG
    if (!image) {
      image =
        "https://res.cloudinary.com/oltenitaimobiliare/image/upload/f_jpg,q_auto/v1739912345/preview_oltenita.jpg";
    }

    const title = listing.title || "Anunț imobiliar din Oltenița";
    const desc =
      listing.description?.substring(0, 160) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița și împrejurimi.";

    // ✅ Link final real (domeniul principal)
    const finalUrl = `https://oltenitaimobiliare.ro/anunt/${listing._id}?utm=facebook`;

    // ✅ HTML complet pentru Facebook (meta-taguri OG)
    const html = `
      <!DOCTYPE html>
      <html lang="ro">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${title}</title>

          <link rel="canonical" href="${finalUrl}" />

          <!-- Open Graph -->
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${desc}" />
          <meta property="og:image" content="${image}" />
          <meta property="og:url" content="${finalUrl}" />
          <meta property="og:site_name" content="Oltenița Imobiliare" />
          <meta property="og:type" content="article" />

          <!-- Twitter -->
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${title}" />
          <meta name="twitter:description" content="${desc}" />
          <meta name="twitter:image" content="${image}" />
        </head>
        <body style="font-family:sans-serif;text-align:center;margin-top:60px;">
          <h2 style="color:#0a58ca;">${title}</h2>
          <p style="max-width:600px;margin:10px auto;">${desc}</p>
          <p>
            <a href="${finalUrl}" style="color:#0a58ca;font-weight:bold;text-decoration:none;">
              👉 Vezi anunțul complet pe Oltenița Imobiliare
            </a>
          </p>

          <!-- Facebook are nevoie de timp să preia meta-tagurile -->
          <script>
            setTimeout(() => {
              window.location.href = "${finalUrl}";
            }, 2500);
          </script>
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
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
