import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conexiune MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectat la MongoDB"))
  .catch(err => console.error("❌ Eroare MongoDB:", err));

// Model simplu Anunț
const anuntSchema = new mongoose.Schema({
  titlu: String,
  descriere: String,
  pret: Number,
  categorie: String,
}, { timestamps: true });

const Anunt = mongoose.model("Anunt", anuntSchema);

// --- Rute ---
// Test
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend OltenitaImobiliare funcționează 🚀" });
});

// ✅ GET toate anunțurile
app.get("/api/anunturi", async (req, res) => {
  const anunturi = await Anunt.find();
  res.json(anunturi);
});

// ✅ POST creare anunț
app.post("/api/anunturi", async (req, res) => {
  try {
    const { titlu, descriere, pret, categorie } = req.body;
    const nou = new Anunt({ titlu, descriere, pret, categorie });
    await nou.save();
    res.status(201).json(nou);
  } catch (err) {
    res.status(500).json({ error: "Eroare la salvarea anunțului" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server pornit pe portul ${PORT}`));
