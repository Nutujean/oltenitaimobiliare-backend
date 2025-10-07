// routes/stripeRoutes.js
import express from "express";
import Stripe from "stripe";
import Listing from "../models/Listing.js";

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const FRONTEND =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_ORIGIN ||
  "https://oltenitaimobiliare.ro";

const PLANS = {
  featured7:  { label: "Promovare anunț – 7 zile",  amountEUR: 5 },
  featured30: { label: "Promovare anunț – 30 zile", amountEUR: 15 },
};

// POST /api/stripe/create-checkout-session
router.post("/create-checkout-session", async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Stripe cheie lipsă (STRIPE_SECRET_KEY)" });
    }

    const { listingId, plan = "featured7" } = req.body || {};
    if (!listingId) return res.status(400).json({ error: "Lipsește listingId" });

    const listing = await Listing.findById(listingId).select("title user").lean();
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    const chosen = PLANS[plan] || PLANS.featured7;
    const amountCents = Math.round(chosen.amountEUR * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "eur",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents, // 5 EUR -> 500
            product_data: {
              name: chosen.label,
              description: listing.title,
              metadata: {
                listingId: String(listing._id),
                plan,
              },
            },
          },
        },
      ],
      metadata: {
        listingId: String(listing._id),
        plan,
      },
      success_url: `${FRONTEND}/promovare-succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND}/anunt/${listing._id}?payment=cancel`,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return res.status(500).json({ error: "Eroare la inițierea plății" });
  }
});

export default router;
