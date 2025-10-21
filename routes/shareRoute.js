import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// ✅ Rută pentru partajare pe Facebook, WhatsApp, etc.
router.get("/share/fb/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).send("Anunțul nu a fost găsit");

    const siteUrl = "https://oltenitaimobiliare.ro";
    const shareUrl = `${siteUrl}/anunt/${listing._id}`;
    const imageUrl =
      listing.images?.[0] ||
      listing.imageUrl ||
      "https://oltenitaimobiliare.ro/preview.jpg";

    const title =
      listing.title?.replace(/"/g, "&quot;") ||
      "Anunț imobiliar din Oltenița";
    const desc =
      listing.description?.substring(0, 150).replace(/"/g, "&quot;") ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița și împrejurimi.";

    // ✅ Antete clare pentru Facebook & Twitter
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // ✅ HTML OG Tags (Facebook citește doar acestea)
    res.send(`<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>

    <!-- Open Graph -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${imageUrl}?v=${Date.now()}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:type" content="article" />

    <!-- Facebook App ID -->
    <meta property="fb:app_id" content="966242223397117" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${imageUrl}?v=${Date.now()}" />
  </head>

  <body>
    <script>
      // După ce Facebook citește meta-urile, redirecționăm către anunțul real
      window.location.href = "${shareUrl}";
    </script>
  </body>
</html>`);
  } catch (err) {
    console.error("❌ Eroare la /share/fb/:id:", err);
    res.status(500).send("Eroare server");
  }
});

export default router;
