import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import Listing from "./models/Listing.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================
// CORS
// ==========================
const allowedOrigins = [
  "http://localhost:5173",
  "https://oltenitaimobiliare.ro",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("CORS blocat pentru origin: " + origin));
      }
    },
    credentials: true,
  })
);

// ✅ Răspuns pentru preflight OPTIONS
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

app.use(express.json());

// ==========================
// Logger global (debug)
// ==========================
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url} | Origin: ${req.headers.origin || "-"}`);
  next();
});

// ==========================
// Multer & Cloudinary
// ==========================
const storage = multer.diskStorage({});
const upload = multer({ storage });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================
// MongoDB
// ==========================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ Eroare MongoDB:", err));

// ==========================
// RUTE
// ==========================
app.get("/", (req, res) => {
  res.send("OK — API OltenitaImobiliare rulează");
});

// GET toate anunțurile
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST adăugare anunț cu imagini
app.post("/api/listings", upload.array("images", 10), async (req, res) => {
  try {
    console.log("📝 Body:", req.body);
    console.log("📂 Files:", req.files);

    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      uploadedImages = await Promise.all(
        req.files.map((file) => cloudinary.uploader.upload(file.path))
      );
    }

    const newListing = new Listing({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      images: uploadedImages.map((u) => u.secure_url),
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error("❌ Eroare la POST /api/listings:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// USERS (simplu)
// ==========================
app.post("/api/register", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: "Email sau parolă greșite" });
    res.json({ message: "Login reușit", user });
  } ca
