// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Config
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// Middleware
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Conectare MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch(err => console.error("❌ Eroare MongoDB:", err.message));

// --- Model Anunt ---
const anuntSchema = new mongoose.Schema({
  titlu: { type: String, required: true },
  descriere: { type: String, required: true },
  pret: { type: Number, required: true },
  categorie: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Anunt = mongoose.model("Anunt", anuntSchema);

// --- Rute ---
// Test
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend funcționează corect 🚀" });
});

// GET toate anunturile
app.get("/api/anunturi", async (req, res) => {
  const anunturi = await Anunt.find().sort({ createdAt: -1 });
  res.json(anunturi);
});

// POST adaugă anunt
app.post("/api/anunturi", async (req, res) => {
  try {
    const { titlu, descriere, pret, categorie } = req.body;
    if (!titlu || !descriere || !pret || !categorie) {
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii" });
    }
    const nou = new Anunt({ titlu, descriere, pret, categorie });
    await nou.save();
    res.status(201).json(nou);
  } catch (err) {
    console.error("❌ Eroare la salvare:", err);
    res.status(500).json({ error: "Eroare la salvarea anunțului" });
  }
});

// Pornire server
app.listen(PORT, () => {
  console.log(`✅ Server OltenitaImobiliare pornit pe portul ${PORT}`);
});
