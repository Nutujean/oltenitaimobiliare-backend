// =======================================================
// 🚀 SHARE SERVER - Oltenița Imobiliare
// =======================================================
import express from "express";

const app = express();

// 🔹 Generare HTML pentru Facebook/WhatsApp share
const ogPage = ({ id, title, description, image, price }) => `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta property="og:title" content="${(title || "").slice(0, 80)}" />
  <meta property="og:description" content="${(description || "Vezi detaliile anunțului.").slice(0, 160)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Oltenița Imobiliare" />
  <meta property="og:url" content="https://share.oltenitaimobiliare.ro/share/${id}" />
  <title>${title || "Anunț"}${price ? " - " + price + " €" : ""}</title>
</head>
<body>
  <noscript>
    <p>Mergi la anunț: <a href="https://api.oltenitaimobiliare.ro/anunt/${id}">click aici</a></p>
  </noscript>
  <script>window.location.href="https://api.oltenitaimobiliare.ro/anunt/${id}";</script>
</body>
</html>`;

// 🔹 Ruta principală de share
app.get("/share/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const apiRes = await fetch(`https://api.oltenitaimobiliare.ro/api/listings/${id}`);
    if (!apiRes.ok) return res.status(404).send("Anunțul nu a fost găsit.");
    const listing = await apiRes.json();

    const image = Array.isArray(listing?.images) && listing.images[0]
      ? listing.images[0]
      : "https://api.oltenitaimobiliare.ro/default-share.jpg";

    const html = ogPage({
      id,
      title: listing?.title || "Anunț imobiliar",
      description: listing?.description || "",
      image,
      price: listing?.price,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    console.error("Eroare SHARE:", e);
    res.status(500).send("Eroare server la generarea paginii de share.");
  }
});

// 🔹 Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true, service: "share", time: new Date().toISOString() }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 SHARE live pe portul ${PORT}`));
