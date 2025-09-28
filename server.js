import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listings.js";

dotenv.config();

const app = express();

// ✅ Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

// ✅ Rute
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);

// ✅ Conectare la MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB conectat");
  app.listen(5000, () => console.log("🚀 Server pornit pe portul 5000"));
})
.catch((err) => console.error("❌ Eroare MongoDB:", err));
