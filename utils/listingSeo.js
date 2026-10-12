export const PUBLIC_SITE = "https://oltenitaimobiliare.ro";

export const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function isPublicListing(listing) {
  return Boolean(listing) && (!listing.visibility || listing.visibility === "public");
}

export function isActiveListing(listing, now = new Date()) {
  const expiresAt = isoDate(listing?.expiresAt);
  return isPublicListing(listing) && listing.status !== "expirat" && listing.vandut !== true
    && (!expiresAt || new Date(expiresAt) > now);
}

export function activeListingFilter(now = new Date()) {
  return { $and: [
    { $or: [{ visibility: "public" }, { visibility: { $exists: false } }] },
    { status: { $ne: "expirat" } },
    { vandut: { $ne: true } },
    { $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }] },
  ] };
}

function publicImage(value) {
  const raw = typeof value === "string" ? value : value?.secure_url || value?.url || "";
  try {
    const url = new URL(raw, PUBLIC_SITE);
    if (!["https:", "http:"].includes(url.protocol) || !raw) return null;
    // Use the same derivative as the application to avoid downloading originals
    // before React loads, or requesting a second Cloudinary transformation.
    const marker = "/image/upload/";
    const markerIndex = url.href.indexOf(marker);
    if (url.hostname === "res.cloudinary.com" && markerIndex >= 0) {
      const prefix = url.href.slice(0, markerIndex + marker.length);
      const rest = url.href.slice(markerIndex + marker.length);
      const versionIndex = rest.search(/v\d+\//);
      const assetPath = versionIndex >= 0 ? rest.slice(versionIndex) : rest;
      return `${prefix}f_auto,q_auto:good,c_limit,w_1600,h_1000/${assetPath}`;
    }
    return url.href;
  } catch { return null; }
}

export function listingSeoData(listing, now = new Date()) {
  const canonical = `${PUBLIC_SITE}/anunt/${listing._id}`;
  const title = `${listing.title || "Anunț imobiliar"} - Oltenița Imobiliare`;
  const description = [listing.title, listing.location, listing.description]
    .filter(Boolean).join(" – ").replace(/\s+/g, " ").trim().slice(0, 180);
  const images = [...new Set([...(listing.images || []), listing.imageUrl].map(publicImage).filter(Boolean))];
  const active = isActiveListing(listing, now);
  const status = listing.vandut ? "Proprietate vândută" : !active ? "Anunț expirat" : listing.rezervat ? "Proprietate rezervată" : "Anunț activ";
  const schema = {
    "@context": "https://schema.org",
    "@type": listing.section === "angajari" || ["cumpar", "schimb"].includes(listing.intent) ? "WebPage" : "RealEstateListing",
    "@id": `${canonical}#page`,
    url: canonical,
    name: listing.title,
    description: listing.description || description,
    inLanguage: "ro-RO",
    isPartOf: { "@type": "WebSite", "@id": `${PUBLIC_SITE}/#website`, name: "Oltenița Imobiliare", url: `${PUBLIC_SITE}/` },
    ...(images.length ? { image: images } : {}),
    ...(isoDate(listing.createdAt) ? { datePublished: isoDate(listing.createdAt) } : {}),
    ...(isoDate(listing.updatedAt) ? { dateModified: isoDate(listing.updatedAt) } : {}),
    ...(listing.location ? { contentLocation: { "@type": "Place", name: listing.location } } : {}),
  };
  return { canonical, title, description, images, active, status, schema };
}

export function listingContent(listing, seo) {
  const details = [
    ["Localitate", listing.location], ["Categorie", listing.category],
    ["Tip ofertă", ({ vand: "Vânzare", inchiriez: "Închiriere", cumpar: "Cumpărare", schimb: "Schimb" })[listing.intent] || (listing.dealType === "inchiriere" ? "Închiriere" : "Vânzare")],
    ["Preț", Number.isFinite(listing.price) ? `${new Intl.NumberFormat("ro-RO").format(listing.price)} €` : null],
    ["Suprafață", listing.surface ? `${listing.surface} m²` : null],
    ["Camere", listing.rooms], ["Etaj", listing.floor], ["Stare", seo.status],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  const phone = String(listing.phone || "").replace(/[^+\d]/g, "");
  return `<main style="max-width:1000px;margin:32px auto;padding:0 20px;font-family:Arial,sans-serif;line-height:1.7;color:#1f2937">
    <nav><a href="/">Acasă</a> › <a href="/anunturi">Anunțuri</a></nav>
    <h1>${escapeHtml(listing.title)}</h1>
    <dl>${details.map(([key, value]) => `<dt style="font-weight:bold">${escapeHtml(key)}</dt><dd style="margin:0 0 10px">${escapeHtml(value)}</dd>`).join("")}</dl>
    <h2>Descriere</h2><p style="white-space:pre-wrap">${escapeHtml(listing.description || "Detaliile sunt disponibile de la autorul anunțului.")}</p>
    ${seo.images.length ? `<h2>Fotografii</h2>${seo.images.map((image, i) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)} – fotografia ${i + 1}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} style="max-width:100%;height:auto;border-radius:12px;margin-bottom:16px" />`).join("")}` : ""}
    ${seo.active && phone ? `<p><a href="tel:${escapeHtml(phone)}">Contactează autorul: ${escapeHtml(listing.phone)}</a></p>` : ""}
    <p><a href="/anunturi">Vezi alte anunțuri</a> · <a href="/contact">Contact platformă</a></p>
  </main>`;
}

export function renderListingHtml(listing, template = null, now = new Date()) {
  const seo = listingSeoData(listing, now);
  const robots = seo.active ? "index, follow" : "noindex, follow";
  const image = seo.images[0] || `${PUBLIC_SITE}/preview.jpg`;
  const metas = `
    <title>${escapeHtml(seo.title)}</title>
    <link data-rh="true" rel="canonical" href="${seo.canonical}" />
    <meta data-rh="true" name="description" content="${escapeHtml(seo.description)}" />
    <meta data-rh="true" name="robots" content="${robots}" />
    <meta data-rh="true" property="og:type" content="article" />
    <meta data-rh="true" property="og:title" content="${escapeHtml(seo.title)}" />
    <meta data-rh="true" property="og:description" content="${escapeHtml(seo.description)}" />
    <meta data-rh="true" property="og:url" content="${seo.canonical}" />
    <meta data-rh="true" property="og:image" content="${escapeHtml(image)}" />
    <meta data-rh="true" name="twitter:card" content="summary_large_image" />
    <meta data-rh="true" name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta data-rh="true" name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta data-rh="true" name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json" data-listing-seo>${JSON.stringify(seo.schema).replace(/</g, "\\u003c")}</script>`;
  const content = listingContent(listing, seo);
  if (!template) return `<!doctype html><html lang="ro"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />${metas}</head><body>${content}</body></html>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<(?:meta|link)\b[^>]*data-rh=["']true["'][^>]*>/gi, "")
    .replace("</head>", `${metas}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

export function renderListingsSitemap(listings, now = new Date()) {
  const entries = listings.filter((listing) => isActiveListing(listing, now)).map((listing) => {
    const modified = isoDate(listing.updatedAt || listing.createdAt);
    return `  <url><loc>${PUBLIC_SITE}/anunt/${escapeHtml(listing._id)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}
