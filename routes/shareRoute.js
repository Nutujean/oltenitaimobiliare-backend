import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/* ============================================================
   🏡 RUTĂ PRINCIPALĂ PENTRU META SHARE (Open Graph)
   ============================================================ */
router.get("/share/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let listing = null;

    try {
      listing = await Listing.findById(id);
    } catch (e) {
      console.error("Eroare la findById în /share/:id:", e);
    }

    // fallback dacă NU găsim anunțul
    if (!listing) {
      const fallbackTitle = "Oltenita Imobiliare - Anunțuri imobiliare în Oltenița și împrejurimi";
      const fallbackDesc =
        "Descoperă cele mai noi anunțuri imobiliare din Oltenița și împrejurimi: case, apartamente, terenuri și spații comerciale.";
      const fallbackImage = "https://oltenitaimobiliare.ro/preview.jpg";

      const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>${fallbackTitle}</title>

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://oltenitaimobiliare.ro/">
  <meta property="og:title" content="${fallbackTitle.replace(/"/g, "&quot;")}">
  <meta property="og:description" content="${fallbackDesc.replace(/"/g, "&quot;")}">
  <meta property="og:image" content="${fallbackImage}">
  <meta property="og:locale" content="ro_RO">
  <meta property="fb:app_id" content="966242223397117">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${fallbackTitle.replace(/"/g, "&quot;")}">
  <meta name="twitter:description" content="${fallbackDesc.replace(/"/g, "&quot;")}">
  <meta name="twitter:image" content="${fallbackImage}">

  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://oltenitaimobiliare.ro/">
</head>
<body>
  <script>
    // dacă nu găsim anunțul, ducem utilizatorul pe homepage
    window.location.href = "https://oltenitaimobiliare.ro/";
  </script>
</body>
</html>`;
      return res.status(200).send(html); // ✅ răspundem 200, NU 404
    }

    // ✅ Avem anunț -> generăm meta pentru el
    const image =
      (Array.isArray(listing.images) && listing.images[0]) ||
      listing.imageUrl ||
      "https://oltenitaimobiliare.ro/preview.jpg";

    const title = (listing.title || "Anunț imobiliar în Oltenița").replace(
      /"/g,
      "&quot;"
    );
    const description = (
      listing.description?.substring(0, 150) ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița."
    ).replace(/"/g, "&quot;");

    const publicUrl = `https://oltenitaimobiliare.ro/anunt/${listing._id}`;

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>${title}</title>

  <meta property="og:type" content="article">
  <meta property="og:url" content="https://share.oltenitaimobiliare.ro/share/${listing._id}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:alt" content="${title}">
  <meta property="og:locale" content="ro_RO">
  <meta property="fb:app_id" content="966242223397117">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${publicUrl}">
</head>
<body>
  <script>
    // după ce Facebook / WhatsApp iau meta-urile, redirecționăm utilizatorul către pagina reală
    window.location.href = "${publicUrl}";
  </script>
</body>
</html>`;

    return res.status(200).send(html); // ✅ 200 OK
  } catch (err) {
    console.error("Eroare la ruta /share/:id:", err);

    // chiar și pe eroare trimitem fallback cu 200
    const fallbackTitle = "Oltenita Imobiliare - Anunțuri imobiliare în Oltenița și împrejurimi";
    const fallbackDesc =
      "Descoperă cele mai noi anunțuri imobiliare din Oltenița și împrejurimi.";
    const fallbackImage = "https://oltenitaimobiliare.ro/preview.jpg";

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>${fallbackTitle}</title>

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://oltenitaimobiliare.ro/">
  <meta property="og:title" content="${fallbackTitle.replace(/"/g, "&quot;")}">
  <meta property="og:description" content="${fallbackDesc.replace(/"/g, "&quot;")}">
  <meta property="og:image" content="${fallbackImage}">
  <meta property="og:locale" content="ro_RO">
  <meta property="fb:app_id" content="966242223397117">
</head>
<body>
  <script>
    window.location.href = "https://oltenitaimobiliare.ro/";
  </script>
</body>
</html>`;
    return res.status(200).send(html);
  }
});

/* ============================================================
   🔵 REDIRECT DIRECT CĂTRE FACEBOOK
   ============================================================ */
router.get("/fb/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const shareUrl = `https://share.oltenitaimobiliare.ro/share/${id}`;
    const redirectUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("Eroare la redirect FB:", err);
    res.redirect("https://oltenitaimobiliare.ro/");
  }
});

export default router;
