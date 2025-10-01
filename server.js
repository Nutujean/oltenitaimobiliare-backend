// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// rutele
import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";
import usersRoutes from "./routes/users.js";

dotenv.config();

const app = express();

/* --------------------------- CORS (dev-friendly) --------------------------- */
// NOTĂ: e deschis ca să evităm „Failed to fetch”. Când vrei, îl restrângem.
app.use(
  cors({
    origin: true, // acceptă orice origin (prod + localhost + postman)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // pune true doar dacă folosești cookie-uri/sesiuni
  })
);
app.options("*", cors()); // preflight

/* ----------------------------- Body parsers ----------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------------- Trust reverse proxy ------------------------- */
app.set("trust proxy", 1);

/* --------------------------- Conexiune MongoDB -------------------------- */
// IMPORTANT: fără fallback la localhost în producție
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI nu este setat în variabilele de mediu.");
  console.error("   Configurează-l în Render → Settings → Environment.");
  process.exit(1);
}

console.log("ℹ️  Încerc conexiunea la MongoDB...");
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err.message);
    process.exit(1); // opțional: poți porni serverul oricum dacă vrei doar health
  });

/* ------------------------------ Healthcheck ----------------------------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* --------------------------------- Rute --------------------------------- */
app.use("/api/auth", authRoutes);        // login/register etc.
app.use("/api/listings", listingsRoutes); // anunțuri
app.use("/api/users", usersRoutes);       // /api/users/me

/* ------------------------------- 404 API -------------------------------- */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Ruta API inexistentă" });
  }
  res.status(404).send("Not found");
});

/* ----------------------------- Pornire server --------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
