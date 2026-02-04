// =======================================================
// SHARE SERVER - Oltenita Imobiliare (OG for Facebook)
// =======================================================
import express from "express";

const app = express();

// API care conține listing-urile (merge sigur)
const API = "https://api.oltenitaimobiliare.ro/api";
const PUBLIC = "https://oltenitaimobiliare.ro";
const FALLBACK_IMG = "https://oltenitaimobiliare.ro/preview.jpg";

// Timeout scurt ca Facebook să nu primească timeout / bad response
const API_TIMEOUT_MS = 2000;

// Cache ca FB să nu lovească serverul continuu (poți mări la 3600 după ce e stabil)
const CACHE_SECONDS = 300;

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ogPage({ id, title, description, image, price }) {
  const t = esc((title || "Oltenita Imobiliare").slice(0, 80));
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
  <meta property="og:locale" content="ro_RO" />

  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:alt" content="${t}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />

  <link rel="canonical" href="${publicUrl}" />

  <!-- IMPORTANT: FB ia OG din HEAD, apoi userul e trimis la anunț -->
  <meta http-equiv="refresh" content="0;url=${publicUrl}" />
</head>
<body>
  <noscript>
    <p>Mergi la anunț: <a href="${publicUrl}">click aici</a></p>
  </noscript>
</body>
</html>`;
}

function setHtmlHeaders(res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
}

// ✅ Ruta principală de share (OG)
app.get("/share/:id", async (req, res) => {
  const { id } = req.params;

  // fallback imediat (200) — niciodată 404/500 către Facebook
  const sendFallback = () => {
    setHtmlHeaders(res);
    return res.status(200).send(
      ogPage({
        id,
        title: "Oltenita Imobiliare",
        description: "Vezi anunțurile imobiliare din Oltenița și împrejurimi.",
        image: FALLBACK_IMG,
      })
    );
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const apiRes = await fetch(`${API}/listings/${id}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timer);

    if (!apiRes.ok) {
      // ⚠️ NU 404 către Facebook
      return sendFallback();
    }

    const listing = await apiRes.json();

    const imageCandidate =
      (Array.isArray(listing?.images) && listing.images[0]) ||
      listing?.imageUrl ||
      "";

    // asigurăm https
    const image =
      typeof imageCandidate === "string" && imageCandidate.startsWith("https://")
        ? imageCandidate
        : FALLBACK_IMG;

    const html = ogPage({
      id,
      title: listing?.title || "Anunț imobiliar",
      description: listing?.description || "",
      image,
      price: listing?.price,
    });

    setHtmlHeaders(res);
    return res.status(200).send(html);
  } catch (e) {
    // orice eroare => tot 200 fallback (ca să nu mai apară "Bad Response Code")
    console.error("Eroare SHARE:", e?.message || e);
    return sendFallback();
  }
});

// ✅ Root (să nu mai vezi Cannot GET /)
app.get("/", (_req, res) => {
  res.status(200).send("OK - share service");
});

// ✅ Healthcheck
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "share", time: new Date().toISOString() })
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 SHARE live pe portul ${PORT}`));
