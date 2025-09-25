import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import listingRoutes from "./routes/listings.js";

dotenv.config();
const app = express();

// ✅ CORS pentru local și producție
const allowedOrigins = [
  "http://localhost:5173",
  "https://oltenitaimobiliare.ro"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan("dev"));

// ✅ Rute
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Backend Oltenita Imobiliare rulează 🚀");
});

// ✅ MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ Eroare conectare MongoDB:", err));

// ✅ Pornire server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează pe portul ${PORT}`);
});
