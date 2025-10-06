// routes/stripeRoutes.js
import express from "express";
import Stripe from "stripe";
import Listing from "../models/Listing.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

// POST /api/stripe/create-checkout-session
router.post("/create-checkout-session", auth, async (req, res) => {
  try {
    const { listingId, plan } = req.body;
    if (!listingId) return res.status(400).json({ error: "Lipsește listingId" });

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    // doar proprietarul poate plăti
    const ownerId = String(listing.user?._id || listing.user);
    const meId = String(req.user?.id || req.user?._id || "");
    if (!meId || meId !== ownerId) {
      return res.status(403).json({ error: "Nu ești proprietarul anunțului" });
    }

    const priceCents = plan === "featured30" ? 1499 : 499; // €14.99 sau €4.99
    const FRONTEND =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_ORIGIN ||
      "https://oltenitaimobiliare.ro";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Promovare anunț: ${listing.title}` },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND}/anunt/${listing._id}?payment=success`,
      cancel_url: `${FRONTEND}/anunt/${listing._id}?payment=cancel`,
      metadata: {
        listingId: listing._id.toString(),
        plan: plan === "featured30" ? "featured30" : "featured7",
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return res.status(500).json({ error: "Eroare la inițierea plății" });
  }
});

export default router;
