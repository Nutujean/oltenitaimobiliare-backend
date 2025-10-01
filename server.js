// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// rutele tale
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js"; // nou

dotenv.config();

const app = express();

// ---------- CORS (dev-friendly: permite toate origin-urile) ----------
/*
 * Notă: ținem CORS deschis ca să dispară „Failed to fetch”.
 * Când vrei să restrângi, vezi comentariul mai jos cu allowedOrigins.
 */
app.use(
  cors({
    origin: true, // ✅ acceptă orice origin (dev + prod)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // true doar dacă folosești cookie-uri/sesiuni
  })
);
app.options("*", cors()); // preflight

/* ▼ Variante STRICTE (activează-le când vrei să restrângi CORS)
const FRONTEND_URL = process.env.FRONTEND_URL || "https://oltenitaimobiliare.ro";
const LOCAL_URL = process.env.LOCAL_URL || "http://localhost:5173";
const allowedOrigins = [FRONTEND_URL, LOCAL_URL, "http://127.0.0.1:5173"].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocat pentru origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.options("*", cors());
*/

// ---------- Body parsers ----------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Trust reverse proxy (Render/Heroku etc.) ----------
app.set("trust proxy", 1);

// ---------- Conexiune MongoDB ----------
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/oltenitaimobiliare";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err);
    process.exit(1);
  });

// ---------- Healthcheck ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---------- Rute API ----------
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/users", usersRoutes);

// ---------- 404 pentru API ----------
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

// ---------- Start server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
