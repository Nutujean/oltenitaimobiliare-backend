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
/* Notă: ținem CORS deschis acum ca să evităm erorile „Failed to fetch”.
   Când vrei să restrângi strict la domeniul tău, vezi blocul comentat de mai jos. */
app.use(
  cors({
    origin: true, // ✅ acceptă orice origin (prod + localhost + postman)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // setează true DOAR dacă folosești sesiuni/cookie-uri
  })
);
app.options("*", cors()); // preflight pentru toate rutele

/* ▼ Varianta STRICTĂ (activeaz-o când ești gata să limitezi la domeniul tău)
const FRONTEND_URL = process.env.FRONTEND_URL || "https://oltenitaimobiliare.ro";
const LOCAL_URL = process.env.LOCAL_URL || "http://localhost:5173";
const allowedOrigins = [FRONTEND_URL, LOCAL_URL, "http://127.0.0.1:5173"];

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

/* ----------------------------- Body parsers ----------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------------- Trust reverse proxy ------------------------- */
app.set("trust proxy", 1);

/* --------------------------- Conexiune MongoDB -------------------------- */
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/oltenitaimobiliare";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch((err) => {
    console.error("❌ Eroare MongoDB:", err);
    process.exit(1);
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
