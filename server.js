// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/authRoutes.js";   // asigură-te că există acest fișier
import listingRoutes from "./routes/listings.js";  // și acesta

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://oltenitaimobiliare.ro"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);


// log mic ca să vezi originea fiecărei cereri
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin || "-"}`);
  next();
});

const corsOptions = {
  origin: (origin, cb) => {
    // permite și request-urile fără Origin (ex: Postman/health checks)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
// preflight
app.options("*", cors(corsOptions));

// ----- Middleware uzual -----
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// ----- Rute -----
app.get("/", (req, res) => {
  res.send("Backend Oltenita Imobiliare rulează 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler (inclusiv erori CORS)
app.use((err, req, res, next) => {
  console.error("🔥 Global error:", err.message);
  if (err.message?.startsWith("Not allowed by CORS")) {
    res
      .status(403)
      .set("Vary", "Origin")
      .json({ error: "Origin not allowed by CORS", origin: req.headers.origin, allowed: ALLOWED_ORIGINS });
  } else {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ----- MongoDB -----
mongoose
  .connect(process.env.MONGO_URI, {
    // opțiunile moderne nu mai sunt necesare, dar le poți adăuga dacă vrei
  })
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ Eroare conectare MongoDB:", err));

// ----- Start server -----
app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe portul ${PORT}`);
});
