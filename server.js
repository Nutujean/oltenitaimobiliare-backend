import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";

// Rute
import listingsRoutes from "./routes/listings.js";
import authRoutes from "./routes/auth.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🔹 Conectare la MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectat"))
  .catch(err => console.error("❌ Eroare MongoDB:", err));

// 🔹 Configurare Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Rute API
app.use("/api/listings", listingsRoutes);
app.use("/api/auth", authRoutes);

// 🔹 Ruta de test
app.get("/", (req, res) => {
  res.send("✅ Backend-ul Oltenita Imobiliare funcționează!");
});

// 🔹 Pornire server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
