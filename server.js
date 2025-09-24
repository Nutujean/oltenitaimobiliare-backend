import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import Listing from "./models/Listing.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================
// Middleware CORS
// ==========================
const allowedOrigins = [
  "http://localhost:5173",          // pentru test local
  "https://oltenitaimobiliare.ro",  // pentru live
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ CORS blocat pentru:", origin);
        callback(new Error("CORS blocat pentru origin: " + origin));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// ==========================
// Conectare MongoDB
// ==========================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ Eroare MongoDB:", err));

// ==========================
// RUTE ANUNȚURI
// ==========================

// GET toate anunțurile
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Eroare server", error: err });
  }
});

// GET un singur anunț după ID
app.get("/api/listings/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu există" });
    }
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: "Eroare server", error: err });
  }
});

// POST adaugă un nou anunț
app.post("/api/listings", async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    res.status(500).json({ message: "Eroare server", error: err });
  }
});

// ==========================
// RUTE USERI
// ==========================

// Register user
app.post("/api/register", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: "Eroare la înregistrare", error: err });
  }
});

// Login user (simplificat, pentru demo)
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password }); // ⚠️ în producție folosește bcrypt!
    if (!user) {
      return res.status(401).json({ message: "Email sau parolă greșite" });
    }
    res.json({ message: "Login reușit", user });
  } catch (err) {
    res.status(500).json({ message: "Eroare la login", error: err });
  }
});

// ==========================
// START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe portul ${PORT}`);
});
