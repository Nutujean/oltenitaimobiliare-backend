// routes/stripeRoutes.js
import express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const router = express.Router();

const FRONTEND =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_ORIGIN ||
  "https://oltenitaimobiliare.ro";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ""; // trebuie sk_test_...
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const PLANS = {
  featured7:  { label: "Promovare anunț – 7 zile",  amountEUR: 5 },
  featured30: { label: "Promovare anunț – 30 zile", amountEUR: 15 },
};

const getIdFromSlug = (slugOrId = "") => {
  const s = String(slugOrId);
  return s.includes("-") ? s.split("-").pop() : s;
};

// ✅ endpoints de verificare rapidă
router.get("/ping", (_req, res) => res.json({ ok: true }));
router.get("/debug", (_req, res) =>
  res.json({
    hasKey: Boolean(STRIPE_SECRET_KEY),
    keyPrefix: STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 7) : null, // "sk_test"
    frontend: FRONTEND,
  })
);

// ✅ create checkout session
router.post("/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      console.error("Stripe secret key lipsește (STRIPE_SECRET_KEY).");
      return res.status(500).json({ error: "Stripe cheie lipsă (STRIPE_SECRET_KEY)" });
    }

    const { listingId, plan = "featured7" } = req.body || {};
    if (!listingId) return res.status(400).json({ error: "Lipsește listingId" });

    const id = getIdFromSlug(listingId);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID anunț invalid" });
    }

    const listing = await Listing.findById(id).select("title").lean();
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
            unit_amount: amountCents,
            product_data: {
              name: chosen.label,
              description: listing.title,
              metadata: { listingId: String(id), plan },
            },
          },
        },
      ],
      metadata: { listingId: String(id), plan },
      success_url: `${FRONTEND}/promovare-succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND}/anunt/${id}?payment=cancel`,
    });

    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    res.status(500).json({ error: e.message || "Eroare la inițierea plății" });
  }
});
// ✅ confirmarea plății după redirectul din Stripe (fără webhook)
router.get("/confirm", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe cheie lipsă (STRIPE_SECRET_KEY)" });
    }

    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "Lipsește session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items.data.price.product"],
    });

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Plata nu este confirmată încă." });
    }

    // listingId + plan le-am pus în metadata la create-checkout-session
    const listingId = session.metadata?.listingId;
    const plan = session.metadata?.plan || "featured7";
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ error: "Metadata lipsă/invalidă" });
    }

    // calculează featuredUntil în funcție de plan
    const now = new Date();
    let days = 7;
    if (plan === "featured30") days = 30;
    const featuredUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const updated = await Listing.findByIdAndUpdate(
      listingId,
      { $set: { featuredUntil } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Anunț inexistent" });

    return res.json({
      ok: true,
      listingId,
      plan,
      featuredUntil,
      message: "Anunțul a fost promovat cu succes.",
    });
  } catch (e) {
    console.error("stripe/confirm error:", e);
    return res.status(500).json({ error: e.message || "Eroare confirmare" });
  }
});

export default router;
