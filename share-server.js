import express from "express";

const app = express();

const API = "https://api.oltenitaimobiliare.ro/api";
const PUBLIC = "https://oltenitaimobiliare.ro";
const FALLBACK_IMG = "https://oltenitaimobiliare.ro/preview.jpg";

const API_TIMEOUT_MS = 2000;
const CACHE_SECONDS = 300;

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setHtmlHeaders(res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
}

function ogPage({ id, title, description, image, price, shareUrl, publicUrl }) {
  const t = esc((title || "Oltenita Imobiliare").slice(0, 80));
  const d = esc((description || "Vezi detaliile anunțului.").slice(0, 160));
  const img = image || FALLBACK_IMG;

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${t}${price ? " - " + esc(String(price)) + " €" : ""}</title>

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Oltenita Imobiliare" />
  <meta property="og:locale" content="ro_RO" />

  <!-- IMPORTANT: exact URL-ul cerut (cu ?v=..., dacă există) -->
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

  <!-- canonical tot pe shareUrl (nu pe SPA) ca să nu deruteze Debugger -->
  <link rel="canonical" href="${shareUrl}" />

  <!-- User redirect -->
  <meta http-equiv="refresh" content="0;url=${publicUrl}" />
</head>
<body>
  <noscript>
    <p>Mergi la anunț: <a href="${publicUrl}">click aici</a></p>
  </noscript>
</body>
</html>`;
}

// Ruta principală
app.get("/share/:id", async (req, res) => {
  const { id } = req.params;

  // shareUrl exact cum a fost cerut (inclusiv query)
  const shareUrl = `https://share.oltenitaimobiliare.ro${req.originalUrl}`;
  const publicUrl = `${PUBLIC}/anunt/${id}`;

  const sendFallback = () => {
    setHtmlHeaders(res);
    return res.status(200).send(
      ogPage({
        id,
        title: "Oltenita Imobiliare",
        description: "Vezi anunțurile imobiliare din Oltenița și împrejurimi.",
        image: FALLBACK_IMG,
        shareUrl,
        publicUrl,
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

    if (!apiRes.ok) return sendFallback();

    const listing = await apiRes.json();

    const imageCandidate =
      (Array.isArray(listing?.images) && listing.images[0]) ||
      listing?.imageUrl ||
      "";

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
      shareUrl,
      publicUrl,
    });

    setHtmlHeaders(res);
    return res.status(200).send(html);
  } catch (e) {
    console.error("Eroare SHARE:", e?.message || e);
    return sendFallback();
  }
});

app.get("/", (_req, res) => res.status(200).send("OK - share service"));
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "share", time: new Date().toISOString() })
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 SHARE live pe portul ${PORT}`));
