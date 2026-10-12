import express from "express";
import Listing from "../models/Listing.js";
import { PUBLIC_SITE, isPublicListing, isActiveListing, renderListingHtml } from "../utils/listingSeo.js";

let shellCache = null;
let shellPending = null;
export async function loadFrontendTemplate() {
  if (shellCache && shellCache.expires > Date.now()) return shellCache.html;
  if (shellPending) return shellPending;
  shellPending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${PUBLIC_SITE}/seo-shell.html`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Frontend shell HTTP ${response.status}`);
      const html = await response.text();
      if (!html.includes('data-seo-shell="true"') || !html.includes('<div id="root"></div>')) throw new Error("Invalid frontend shell");
      shellCache = { html, expires: Date.now() + 30000 };
      return html;
    } catch (error) {
      console.warn("Frontend shell temporarily unavailable:", error.message);
      return null; // Property content stays readable even during a frontend outage.
    } finally { clearTimeout(timer); shellPending = null; }
  })();
  return shellPending;
}

const PUBLIC_FIELDS = "title description price category location section images imageUrl phone status visibility vandut rezervat expiresAt floor surface rooms dealType intent createdAt updatedAt";

export function createListingSeoRouter({ ListingModel = Listing, getTemplate = loadFrontendTemplate } = {}) {
  const router = express.Router();
  router.get("/seo/anunt/:id", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const unavailable = () => res.status(404).set("X-Robots-Tag", "noindex, follow").type("html").send(
      '<!doctype html><html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Anunț indisponibil | Oltenița Imobiliare</title><meta name="robots" content="noindex, follow"></head><body><main><h1>Anunțul nu a fost găsit</h1><p><a href="/anunturi">Vezi anunțurile disponibile</a></p></main></body></html>'
    );
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return unavailable();
    try {
      const listing = await ListingModel.findById(req.params.id).select(PUBLIC_FIELDS).lean().exec();
      if (!isPublicListing(listing)) return unavailable();
      res.set("X-Robots-Tag", isActiveListing(listing) ? "index, follow" : "noindex, follow");
      const template = await getTemplate();
      return res.type("html").send(renderListingHtml(listing, template));
    } catch (error) {
      console.error("Listing SEO error:", error.message);
      return res.status(503).set("Retry-After", "60").set("X-Robots-Tag", "noindex").type("html").send('<!doctype html><html lang="ro"><head><meta charset="UTF-8"><title>Temporar indisponibil</title></head><body><h1>Anunț temporar indisponibil</h1><p>Reîncearcă în câteva momente.</p></body></html>');
    }
  });
  return router;
}

export default createListingSeoRouter();
