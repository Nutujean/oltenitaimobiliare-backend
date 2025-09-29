import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import listingsRoutes from "./routes/listings.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// Rute
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);

// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB conectat");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () =>
      console.log(`🚀 Server pornit pe portul ${PORT}`)
    );
  })
  .catch((err) => console.error("❌ Eroare conectare MongoDB:", err.message));
