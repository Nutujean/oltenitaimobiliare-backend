// =======================================================
// SHARE SERVER - Oltenita Imobiliare
// =======================================================
import express from "express";

const app = express();

// API care conține listing-urile
const API = "https://api.oltenitaimobiliare.ro/api";
const PUBLIC = "https://oltenitaimobiliare.ro";
const FALLBACK_IMG = "https://oltenitaimobiliare.ro/preview.jpg";

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ogPage = ({ id, title, description, image, price }) => {
  const t = esc((title || "").slice(0, 80));
  const d = esc((description || "Vezi detaliile anunțului.").slice(0, 160));
  const img = image || FALLBACK_IMG;

  const shareUrl = `https://share.oltenitaimobiliare.ro/share/${id}`;
  const publicUrl = `${PUBLIC}/anunt/${id}`;

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${t}${price ? " - " + esc(String(price)) + " €" : ""}</title>

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Oltenita Imobiliare" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:locale" content="ro_RO" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />

  <!-- redirect sigur pentru user (Facebook ia meta-urile din HEAD) -->
  <meta http-equiv="refresh" content="0;url=${publicUrl}" />
</head>
<body>
  <noscript>
    <p>Mergi la anunț: <a href="${publicUrl}">click aici</a></p>
  </noscript>
</body>
</html>`;
};

// Ruta principală de share
app.get("/share/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const apiRes = await fetch(`${API}/listings/${id}`, {
      headers: { Accept: "application/json" },
    });

    // dacă nu găsim listing, tot dăm o pagină OG fallback (NU 404),
    // ca Facebook să aibă mereu imagine și titlu.
    if (!apiRes.ok) {
      const html = ogPage({
        id,
        title: "Oltenita Imobiliare",
        description: "Vezi anunțurile imobiliare din Oltenița și împrejurimi.",
        image: FALLBACK_IMG,
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    const listing = await apiRes.json();

    const image =
      (Array.isArray(listing?.images) && listing.images[0]) ||
      listing?.imageUrl ||
      FALLBACK_IMG;

    const html = ogPage({
      id,
      title: listing?.title || "Anunț imobiliar",
      description: listing?.description || "",
      image,
      price: listing?.price,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (e) {
    console.error("Eroare SHARE:", e);

    // fallback (tot 200)
    const html = ogPage({
      id,
      title: "Oltenita Imobiliare",
      description: "Vezi anunțurile imobiliare din Oltenița și împrejurimi.",
      image: FALLBACK_IMG,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  }
});

// Healthcheck
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "share", time: new Date().toISOString() })
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 SHARE live pe portul ${PORT}`)
);
