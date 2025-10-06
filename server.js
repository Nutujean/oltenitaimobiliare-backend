// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Stripe from "stripe";

import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import Listing from "./models/Listing.js";

dotenv.config();
const app = express();

/* ---------------- CORS (deschis) ---------------- */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.options("*", cors());

app.set("trust proxy", 1);

/* ---------------- MongoDB ---------------- */
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/oltenitaimobiliare";

(async () => {
  console.log("ℹ️  Încerc conexiunea la MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ MongoDB conectat");
})().catch((err) => {
  console.error("❌ Eroare MongoDB:", err);
  process.exit(1);
});

/* ------------- STRIPE WEBHOOK (raw body!) ------------- */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(400).send("Missing STRIPE_WEBHOOK_SECRET");

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("Webhook verify failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { listingId, plan } = session.metadata || {};
        if (listingId) {
          const days = plan === "featured30" ? 30 : 7;
          const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          await Listing.findByIdAndUpdate(listingId, {
            isFeatured: true,
            featuredUntil: until,
          });
          console.log(
            `✅ Listing ${listingId} promovat până la ${until.toISOString()}`
          );
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).send("Server error");
    }
  }
);

/* -------- Body parsers (după webhook) -------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- Health ---------------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ---------------- Rute API ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/stripe", stripeRoutes);

/* -------------- 404 API -------------- */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

/* -------------- Start -------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server pornit pe portul ${PORT}`));
