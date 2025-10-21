// routes/shareRoute.js
import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

// 🧩 Rută pentru partajare Facebook / WhatsApp / etc.
router.get("/share/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).send("Anunțul nu a fost găsit");
    }

    const siteUrl = "https://oltenitaimobiliare.ro";
    const shareUrl = `${siteUrl}/anunt/${listing._id}`;

    // 🖼️ Imagine OG – prima imagine reală a anunțului (Cloudinary + fallback)
    const imageUrl =
      listing.images?.[0] ||
      "https://res.cloudinary.com/oltenita/image/upload/v1729488390/preview_default.jpg";

    const title = listing.title || "Anunț imobiliar din Oltenița";
    const desc =
      listing.description?.substring(0, 150) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița și împrejurimi.";

    // ✅ Antete clare pentru Facebook / TikTok / WhatsApp
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "User-Agent-Allow",
      "facebookexternalhit/1.1;Facebot;Twitterbot;WhatsApp"
    );

    // ✅ HTML static cu meta OG (citit de Facebook, fără JS)
    res.send(`
      <!DOCTYPE html>
      <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <meta property="og:title" content="${title.replace(/"/g, "&quot;")}" />
        <meta property="og:description" content="${desc.replace(/"/g, "&quot;")}" />
        <meta property="og:image" content="${imageUrl}?f_auto&v=3" />
        <meta property="og:url" content="${shareUrl}" />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title.replace(/"/g, "&quot;")}" />
        <meta name="twitter:description" content="${desc.replace(/"/g, "&quot;")}" />
        <meta name="twitter:image" content="${imageUrl}?f_auto&v=3" />
        <title>${title}</title>
      </head>
      <body>
        <script>
          // După ce Facebook a citit meta-urile, redirecționează userul real
          window.location.href = "${shareUrl}";
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
