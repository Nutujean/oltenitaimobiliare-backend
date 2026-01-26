// routes/stripeRoutes.js
import express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const router = express.Router();

// 🔹 URL frontend
const FRONTEND =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_ORIGIN ||
  "https://oltenitaimobiliare.ro";

// 🔹 Stripe config
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

// 🔹 Planuri de promovare
const PLANS = {
  featured7: { label: "Promovare anunț – 7 zile", amountRON: 30 },
  featured14: { label: "Promovare anunț – 14 zile", amountRON: 50 },
  featured30: { label: "Promovare anunț – 30 zile", amountRON: 80 },
  job30: { label: "Angajare – 30 zile (promovat)", amountRON: 49 },
};

// 🔹 Helper pentru extragerea ID-ului din slug
const getIdFromSlug = (slugOrId = "") => {
  const s = String(slugOrId);
  return s.includes("-") ? s.split("-").pop() : s;
};

// ✅ Test rute
router.get("/ping", (_req, res) => res.json({ ok: true }));
router.get("/debug", (_req, res) =>
  res.json({
    hasKey: Boolean(STRIPE_SECRET_KEY),
    keyPrefix: STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 7) : null,
    frontend: FRONTEND,
  })
);

/* =======================================================
   ✅ Ruta clasică — POST /create-checkout-session
======================================================= */
router.post("/create-checkout-session", async (req, res) => {
  try {
    if (!stripe)
      return res
        .status(500)
        .json({ error: "Stripe cheie lipsă (STRIPE_SECRET_KEY)" });

    const { listingId, plan = "featured7" } = req.body || {};
    if (!listingId) return res.status(400).json({ error: "Lipsește listingId" });

    const id = getIdFromSlug(listingId);
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "ID anunț invalid" });

    const listing = await Listing.findById(id).select("title").lean();
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    const chosen = PLANS[plan] || PLANS.featured7;
    const amountBani = Math.round(chosen.amountRON * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "ron",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "ron",
            unit_amount: amountBani,
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
      cancel_url: `${FRONTEND}/promovare-anulata`,
    });

    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    res.status(500).json({ error: e.message || "Eroare la inițierea plății" });
  }
});

/* =======================================================
   ✅ Varianta nouă — POST /create-checkout-session/:listingId
======================================================= */
router.post("/create-checkout-session/:listingId", async (req, res) => {
  try {
    if (!stripe)
      return res
        .status(500)
        .json({ error: "Stripe cheie lipsă (STRIPE_SECRET_KEY)" });

    const { listingId } = req.params;
    const { plan = "featured7" } = req.body || {};
    if (!listingId) return res.status(400).json({ error: "Lipsește listingId" });

    const id = getIdFromSlug(listingId);
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: "ID anunț invalid" });

    const listing = await Listing.findById(id).select("title").lean();
    if (!listing) return res.status(404).json({ error: "Anunț inexistent" });

    const chosen = PLANS[plan] || PLANS.featured7;
    const amountBani = Math.round(chosen.amountRON * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "ron",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "ron",
            unit_amount: amountBani,
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
      cancel_url: `${FRONTEND}/promovare-anulata`,
    });

    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("create-checkout-session/:id error:", e);
    res.status(500).json({ error: e.message || "Eroare la inițierea plății" });
  }
});

/* =======================================================
   ✅ Confirmare plată (manuală, fără webhook)
======================================================= */
router.get("/confirm", async (req, res) => {
  try {
    if (!stripe)
      return res
        .status(500)
        .json({ error: "Stripe cheie lipsă (STRIPE_SECRET_KEY)" });

    let { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "Lipsește session_id" });

    let listingId = null;
    let plan = "featured7";
    let paymentStatus = null;

    // 1) Checkout Session (cs_)
    if (String(session_id).startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(session_id);

      paymentStatus = session.payment_status;
      if (paymentStatus !== "paid")
        return res.status(400).json({ error: "Plata nu este confirmată încă." });

      listingId = session.metadata?.listingId;
      plan = session.metadata?.plan || "featured7";
    }

    // 2) PaymentIntent (pi_)
    if (String(session_id).startsWith("pi_")) {
      const pi = await stripe.paymentIntents.retrieve(session_id);

      paymentStatus = pi.status;
      if (paymentStatus !== "succeeded") {
        return res.status(400).json({ error: "Plata nu este confirmată încă." });
      }

      listingId = pi.metadata?.listingId || null;
      plan = pi.metadata?.plan || "featured7";
    }

    // 3) Charge (ch_)
    if (String(session_id).startsWith("ch_")) {
      const ch = await stripe.charges.retrieve(session_id);

      if (!ch.paid)
        return res.status(400).json({ error: "Plata nu este confirmată încă." });

      const piId = ch.payment_intent;
      if (piId && String(piId).startsWith("pi_")) {
        const pi = await stripe.paymentIntents.retrieve(piId);
        if (pi.status !== "succeeded")
          return res.status(400).json({ error: "Plata nu este confirmată încă." });

        listingId = pi.metadata?.listingId || null;
        plan = pi.metadata?.plan || "featured7";
      }
    }

    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        error:
          "Nu am găsit listingId în metadata plății. (Plata este ok, dar nu e legată de anunț.)",
      });
    }

    // ✅ durata
    let days = 7;
    if (plan === "featured14") days = 14;
    if (plan === "featured30") days = 30;
    if (plan === "job30") days = 30;

    const featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // ✅ citim anunțul curent (INCLUDE section/category ca să nu stricăm)
    const existing = await Listing.findById(listingId)
      .select("visibility status expiresAt section category")
      .lean();
    if (!existing) return res.status(404).json({ error: "Anunț inexistent" });

    // ✅ setări de bază
    const setUpdate = {
      featuredUntil,
      featured: true,
      isFree: false,
    };

    // ✅ IMPORTANT: separăm clar job vs imobiliare (NU se amestecă)
    const isJob = plan === "job30" || existing.section === "angajari";
    if (isJob) {
      setUpdate.section = "angajari";
      // opțional, ca să fie consistent
      if (!existing.category || existing.category === "Angajări") {
        setUpdate.category = "Angajări";
      }
    } else {
      // pentru promovări normale, anunțul rămâne imobiliare
      setUpdate.section = existing.section || "imobiliare";
    }

    // ✅ dacă e draft, îl publicăm automat după plată
    if (existing.visibility === "draft") {
      setUpdate.visibility = "public";

      // expirare: minim featuredUntil, dar pentru draft setăm 30 zile (clasic),
      // iar dacă featuredUntil e mai mare (nu e cazul), îl respectăm.
      const expiresAtDraft = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setUpdate.expiresAt =
        expiresAtDraft > featuredUntil ? expiresAtDraft : featuredUntil;

      if (!existing.status) setUpdate.status = "disponibil";
    }

    // ✅ dacă NU e draft, dar e expirat, îl reactivăm automat
    let reactivated = false;
    if (existing.visibility !== "draft") {
      const now = new Date();
      const isExpiredByDate =
        existing.expiresAt && new Date(existing.expiresAt) < now;
      const isExpiredByStatus =
        String(existing.status || "").toLowerCase() === "expirat";

      if (isExpiredByDate || isExpiredByStatus) {
        setUpdate.status = "disponibil";

        const currentExpires = existing.expiresAt ? new Date(existing.expiresAt) : null;
        setUpdate.expiresAt =
          currentExpires && currentExpires > featuredUntil
            ? currentExpires
            : featuredUntil;

        reactivated = true;
      }
    }

    const updated = await Listing.findByIdAndUpdate(
      listingId,
      { $set: setUpdate },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Anunț inexistent" });

    let message = "Plata confirmată. Anunțul a fost promovat.";
    if (existing.visibility === "draft") {
      message = "Plata confirmată. Draftul a fost publicat și promovat.";
    } else if (reactivated) {
      message =
        `Plata confirmată. Anunțul era expirat — a fost reactivat și promovat (activ până la ${new Date(
          setUpdate.expiresAt
        ).toLocaleDateString("ro-RO")}).`;
    }

    return res.json({
      ok: true,
      listingId,
      plan,
      featuredUntil,
      message,
    });
  } catch (e) {
    console.error("stripe/confirm error:", e);
    res.status(500).json({ error: e.message || "Eroare confirmare" });
  }
});

export default router;