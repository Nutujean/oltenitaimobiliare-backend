import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// 🔵 Rută specială pentru Facebook sharer (fără redirect)
router.get("/share/fb/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).send("Anunțul nu a fost găsit");

    const siteUrl = "https://oltenitaimobiliare.ro";
    const listingUrl = `${siteUrl}/anunt/${listing._id}`;
    const imageUrl = listing.images?.[0];

    if (!imageUrl) return res.status(404).send("Anunțul nu are imagine validă");

    const title = listing.title || "Anunț imobiliar din Oltenița";
    const desc =
      listing.description?.substring(0, 150) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița.";

    // ✅ Facebook citește meta-tagurile direct (fără JavaScript)
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(`
      <!DOCTYPE html>
      <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <meta property="og:title" content="${title.replace(/"/g, "&quot;")}" />
        <meta property="og:description" content="${desc.replace(/"/g, "&quot;")}" />
        <meta property="og:image" content="${imageUrl}?v=7" />
        <meta property="og:url" content="${listingUrl}" />
        <meta property="og:type" content="article" />
        <meta property="fb:app_id" content="966242223397117" />
        <meta name="twitter:card" content="summary_large_image" />
        <title>${title}</title>
      </head>
      <body style="font-family:Arial;text-align:center;margin-top:80px;color:#333;">
        <h2>${title}</h2>
        <p>${desc}</p>
        <img src="${imageUrl}" alt="Imagine anunț" style="max-width:90%;border-radius:12px;margin-top:20px;" />
        <br/><br/>
        <a href="${listingUrl}" style="display:inline-block;padding:10px 20px;background:#1877F2;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
          Vezi anunțul complet
        </a>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("❌ Eroare la /share/fb/:id:", err);
    res.status(500).send("Eroare server");
  }
});

export default router;
