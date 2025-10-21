import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/* ============================================================
   🏡 RUTĂ PRINCIPALĂ PENTRU META SHARE (Open Graph)
   ============================================================ */
router.get("/share/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
      return res.status(404).send("Anunțul nu a fost găsit");
    }

    const image =
      listing.images?.[0] ||
      listing.imageUrl ||
      "https://oltenitaimobiliare.ro/og-default.jpg";

    // ✅ HTML complet pentru Facebook / WhatsApp / LinkedIn etc.
    res.send(`<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>${listing.title}</title>
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://share.oltenitaimobiliare.ro/share/fb/${listing._id}">
  <meta property="og:title" content="${listing.title}">
  <meta property="og:description" content="${listing.description?.substring(0, 150) || "Vezi detalii despre acest anunț imobiliar din Oltenița"}">
  <meta property="og:image" content="${image}?v=9">
  <meta property="og:image:alt" content="${listing.title}">
  <meta property="fb:app_id" content="966242223397117">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${listing.title}">
  <meta name="twitter:description" content="${listing.description?.substring(0, 150) || ""}">
  <meta name="twitter:image" content="${image}?v=9">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://oltenitaimobiliare.ro/anunt/${listing._id}">
</head>
<body>
  <script>
    // Redirecționare automată către pagina reală a anunțului
    window.location.href = "https://oltenitaimobiliare.ro/anunt/${listing._id}";
  </script>
</body>
</html>`);
  } catch (err) {
    console.error("Eroare la ruta /share/:id:", err);
    res.status(500).send("Eroare server");
  }
});

/* ============================================================
   🔵 REDIRECT DIRECT CĂTRE FACEBOOK (100% STABIL)
   ============================================================ */
router.get("/fb/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const shareUrl = `https://share.oltenitaimobiliare.ro/share/fb/${id}`;
    const redirectUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("Eroare la redirect FB:", err);
    res.status(500).send("Eroare la redirect Facebook");
  }
});

export default router;
