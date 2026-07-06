import express from "express";

const router = express.Router();

// ✅ API-ul care sigur vede anunțurile
const API_BASE = "https://api.oltenitaimobiliare.ro/api";

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

function isBot(userAgent = "") {
  return /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|TelegramBot|Slackbot|Discordbot|crawler|spider|bot/i.test(
    String(userAgent || "")
  );
}

function extractImageUrl(value) {
  if (!value) return "";

  if (typeof value === "string") return value.trim();

  if (typeof value === "object") {
    return (
      value.secure_url ||
      value.url ||
      value.src ||
      value.path ||
      value.imageUrl ||
      value.image ||
      ""
    );
  }

  return "";
}

function normalizeImageUrl(url) {
  const clean = String(url || "").trim();

  if (!clean) return FALLBACK.image;

  if (clean.startsWith("//")) return `https:${clean}`;
  if (clean.startsWith("http://")) return clean.replace("http://", "https://");
  if (clean.startsWith("https://")) return clean;
  if (clean.startsWith("/")) return `https://oltenitaimobiliare.ro${clean}`;

  return clean;
}

function getListingImage(listing = {}) {
  const candidates = [];

  if (Array.isArray(listing.images)) candidates.push(...listing.images);
  if (Array.isArray(listing.photos)) candidates.push(...listing.photos);
  if (Array.isArray(listing.gallery)) candidates.push(...listing.gallery);

  candidates.push(
    listing.imageUrl,
    listing.image,
    listing.photo,
    listing.thumbnail,
    listing.coverImage,
    listing.mainImage
  );

  for (const item of candidates) {
    const url = extractImageUrl(item);
    if (url) return normalizeImageUrl(url);
  }

  return FALLBACK.image;
}

function renderHtml({ title, description, image, shareUrl, canonicalUrl, redirectTo, shouldRedirect }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(normalizeImageUrl(image || FALLBACK.image));
  const ogUrl = escapeHtml(shareUrl);
  const canonical = escapeHtml(canonicalUrl);
  const redirect = escapeHtml(redirectTo);

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>${t}</title>

  <meta property="og:type" content="article">
  <meta property="og:url" content="${ogUrl}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:secure_url" content="${img}">
  <meta property="og:image:alt" content="${t}">
  <meta property="og:locale" content="ro_RO">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">

  <link rel="canonical" href="${canonical}">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  ${
    shouldRedirect
      ? `<script>window.location.replace("${redirect}");</script>`
      : ""
  }
</head>
<body style="font-family: Arial, sans-serif; padding: 24px;">
  <h1>${t}</h1>
  <p>${d}</p>
  <p><a href="${redirect}">Deschide anunțul</a></p>
</body>
</html>`;
}

async function buildSharePage(req, res) {
  const { id } = req.params;
  const sharePath = req.path.startsWith("/fb/") ? "fb" : "share";

  const shareUrl = `https://share.oltenitaimobiliare.ro/${sharePath}/${id}`;
  const apiUrl = `${API_BASE}/listings/${id}`;
  const shouldRedirect = !isBot(req.headers["user-agent"]);

  // Facebook cache-uiește agresiv. Păstrăm cache mic pe server.
  res.set("Cache-Control", "public, max-age=60");

  try {
    const r = await fetch(apiUrl, { headers: { Accept: "application/json" } });

    if (!r.ok) {
      const html = renderHtml({
        title: FALLBACK.title,
        description: FALLBACK.desc,
        image: FALLBACK.image,
        shareUrl,
        canonicalUrl: FALLBACK.url,
        redirectTo: FALLBACK.url,
        shouldRedirect,
      });

      return res.status(200).type("html").send(html);
    }

    const listing = await r.json();

    const titleParts = [];
    if (listing?.title) titleParts.push(String(listing.title));
    if (listing?.price) titleParts.push(`${listing.price} €`);
    if (listing?.location) titleParts.push(String(listing.location));

    const title = titleParts.length
      ? titleParts.join(" - ")
      : "Anunț imobiliar în Oltenița";

    const description =
      (listing?.description ? String(listing.description).replace(/\s+/g, " ").slice(0, 180) : "") ||
      "Vezi detalii despre acest anunț imobiliar din Oltenița.";

    const image = getListingImage(listing);

    const publicUrl = `https://oltenitaimobiliare.ro/anunt/${listing._id || id}`;

    const html = renderHtml({
      title,
      description,
      image,
      shareUrl,
      canonicalUrl: publicUrl,
      redirectTo: publicUrl,
      shouldRedirect,
    });

    return res.status(200).type("html").send(html);
  } catch (err) {
    const html = renderHtml({
      title: FALLBACK.title,
      description: FALLBACK.desc,
      image: FALLBACK.image,
      shareUrl,
      canonicalUrl: FALLBACK.url,
      redirectTo: FALLBACK.url,
      shouldRedirect,
    });

    return res.status(200).type("html").send(html);
  }
}

/* ============================================================
   🏡 RUTE PENTRU META SHARE (Open Graph)
   /share/:id - varianta standard
   /fb/:id    - compatibilitate cu butoanele mai vechi din site
   ============================================================ */
router.get("/share/:id", buildSharePage);
router.get("/fb/:id", buildSharePage);

export default router;
