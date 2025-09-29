import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "*"
}));

// Rute
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);

// Conexiune MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB conectat");
    app.listen(5000, () => console.log("🚀 Server pornit pe portul 5000"));
  })
  .catch((err) => console.error("❌ Eroare MongoDB:", err));
