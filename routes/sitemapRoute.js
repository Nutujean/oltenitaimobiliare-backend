import express from "express";
import Listing from "../models/Listing.js";

const router = express.Router();

/**
 * 🗺️ Generate dynamic sitemap for Google
 */
router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://oltenitaimobiliare.ro";
    const listings = await Listing.find({}, "_id updatedAt").sort({ updatedAt: -1 });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Pagini statice
    const staticPages = ["", "contact", "despre", "termeni-si-conditii"];
    staticPages.forEach((page) => {
      xml += `
        <url>
          <loc>${baseUrl}/${page}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>`;
    });

    // Anunțuri dinamice
    listings.forEach((listing) => {
      xml += `
        <url>
          <loc>${baseUrl}/anunt/${listing._id}</loc>
          <lastmod>${listing.updatedAt.toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.9</priority>
        </url>`;
    });

    xml += `\n</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("❌ Eroare sitemap:", err);
    res.status(500).send("Eroare la generarea sitemap-ului");
  }
});

export default router;
