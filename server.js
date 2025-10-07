// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// rute existente
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";
// ✅ nou: STRIPE
import stripeRoutes from "./routes/stripeRoutes.js";

dotenv.config();

const app = express();

/* ---------- CORS deschis (elimină preflight fail) ---------- */
app.use(
  cors({
    origin: (origin, cb) => cb(null, true), // permite orice origin (prod + localhost)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.options("*", cors()); // preflight global

/* ---------- Parsere ---------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------- DB ---------- */
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/oltenitaimobiliare";

console.log("ℹ️  Încerc conexiunea la MongoDB...");
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err);
    process.exit(1);
  });

/* ---------- Health ---------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ---------- RUTE API ---------- */
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/users", usersRoutes);

// ✅ MONTEAZĂ STRIPE AICI
app.use("/api/stripe", stripeRoutes);
console.log("✔ Stripe routes mounted at /api/stripe");

/* ---------- 404 API ---------- */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
