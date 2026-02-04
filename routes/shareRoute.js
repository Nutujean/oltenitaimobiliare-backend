import express from "express";

const router = express.Router();

// ✅ API-ul care sigur vede anunțurile
const API_BASE = "https://api.oltenitaimobiliare.ro/api";

// fallback
const FALLBACK = {
  title: "Oltenita Imobiliare - Anunțuri imobiliare în Oltenița și împrejurimi",
  desc: "Descoperă cele mai noi anunțuri imobiliare din Oltenița și împrejurimi: case, apartamente, terenuri și spații comerciale.",
  image: "https://oltenitaimobiliare.ro/preview.jpg",
  url: "https://oltenitaimobiliare.ro/",
};

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml({ title, description, image, shareUrl, canonicalUrl, redirectTo }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = image || FALLBACK.image;

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>${t}</title>

  <meta property="og:type" content="article">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:secure_url" content="${img}">
  <meta property="og:image:alt" content="${t}">
  <meta property="og:locale" content="ro_RO">
  <meta property="fb:app_id" content="966242223397117">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">

  <link rel="canonical" href="${canonicalUrl}">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- ✅ Redirecționare sigură (Facebook citește meta-urile din HEAD) -->
  <meta http-equiv="refresh" content="0;url=${redirectTo}">
</head>
<body>
  <noscript>
    <a href="${redirectTo}">Deschide anunțul</a>
  </noscript>
</body>
</html>`;
}

/* ============================================================
   🏡 RUTĂ PRINCIPALĂ PENTRU META SHARE (Open Graph)
   ============================================================ */
router.get("/share/:id", async (req, res) => {
  const { id } = req.params;

  // URL-uri
  const shareUrl = `https://share.oltenitaimobiliare.ro/share/${id}`;
  const apiUrl = `${API_BASE}/listings/${id}`;

  try {
    // Node 18+ are fetch global (pe Render, de obicei este)
    const r = await fetch(apiUrl, { headers: { "Accept": "application/json" } });

    if (!r.ok) {
      // dacă API nu găsește, dăm fallback OG + redirect la homepage
      const html = renderHtml({
        title: FALLBACK.title,
        description: FALLBACK.desc,
        image: FALLBACK.image,
        shareUrl,
        canonicalUrl: FALLBACK.url,
        redirectTo: FALLBACK.url,
      });
      return res.status(200).type("html").send(html);
    }

    const listing = await r.json();

    const title = listing?.title || "Anunț imobiliar în Oltenița";
    const description =
      (listing?.description ? String(listing.description).slice(0, 150) : "") ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița.";

    const image =
      (Array.isArray(listing?.images) && listing.images[0]) ||
      listing?.imageUrl ||
      FALLBACK.image;

    const publicUrl = `https://oltenitaimobiliare.ro/anunt/${listing._id || id}`;

    const html = renderHtml({
      title,
      description,
      image,
      shareUrl,
      canonicalUrl: publicUrl,
      redirectTo: publicUrl,
    });

    return res.status(200).type("html").send(html);
  } catch (err) {
    // fallback în caz de eroare
    const html = renderHtml({
      title: FALLBACK.title,
      description: FALLBACK.desc,
      image: FALLBACK.image,
      shareUrl,
      canonicalUrl: FALLBACK.url,
      redirectTo: FALLBACK.url,
    });
    return res.status(200).type("html").send(html);
  }
});

export default router;
