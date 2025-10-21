import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// 🧩 Rută pentru partajare Facebook / WhatsApp / etc.
router.get("/share/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).send("Anunțul nu a fost găsit");

    const siteUrl = "https://oltenitaimobiliare.ro";
    const shareUrl = `${siteUrl}/anunt/${listing._id}`;

    // 🖼️ Imagine OG – prima imagine reală a anunțului
    const imageUrl = listing.images?.[0];
    if (!imageUrl) return res.status(404).send("Anunțul nu are imagine validă");

    const title = listing.title || "Anunț imobiliar din Oltenița";
    const desc =
      listing.description?.substring(0, 150) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița.";

    // ✅ Antete clare pentru bot-urile Facebook
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // ✅ HTML static cu meta OG real (Facebook citește doar asta)
    res.send(`
      <!DOCTYPE html>
      <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <meta property="og:title" content="${title.replace(/"/g, "&quot;")}" />
        <meta property="og:description" content="${desc.replace(/"/g, "&quot;")}" />
        <meta property="og:image" content="${imageUrl}?v=5" />
        <meta property="og:url" content="${shareUrl}" />
        <meta property="og:type" content="article" />
        <meta property="fb:app_id" content="966242223397117" />
        <meta name="twitter:card" content="summary_large_image" />
        <title>${title}</title>
      </head>
      <body>
        <p>Redirecționare în curs...</p>
        <script>
          setTimeout(() => {
            window.location.href = "${shareUrl}";
          }, 1500); // 1.5 secunde delay pentru ca Facebook să preia OG tags
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("❌ Eroare la /share/:id:", err);
    res.status(500).send("Eroare server");
  }
});

export default router;
