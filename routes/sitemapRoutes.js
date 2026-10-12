import express from "express";
import Listing from "../models/Listing.js";
import { activeListingFilter, renderListingsSitemap } from "../utils/listingSeo.js";

export function createSitemapRouter({ ListingModel = Listing } = {}) {
  const router = express.Router();
  router.get(["/sitemap.xml", "/sitemap-listings.xml"], async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const now = new Date();
      const listings = await ListingModel.find(activeListingFilter(now))
        .select("_id updatedAt createdAt visibility status expiresAt vandut")
        .sort({ _id: 1 }).lean().exec();
      return res.type("application/xml").send(renderListingsSitemap(listings, now));
    } catch (error) {
      console.error("Listings sitemap error:", error.message);
      return res.status(503).set("Retry-After", "60").type("text/plain").send("Sitemap temporar indisponibil.");
    }
  });
  return router;
}

export default createSitemapRouter();
