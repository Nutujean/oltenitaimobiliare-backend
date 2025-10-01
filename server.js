import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import listingRoutes from "./routes/listings.js";

dotenv.config();

const app = express();

// ✅ Middleware pentru JSON
app.use(express.json());

// ✅ Configurare CORS (localhost + domeniul live)
const allowedOrigins = [
  "http://localhost:5173",          // pentru frontend local (vite dev)
  "https://oltenitaimobiliare.ro",  // pentru frontend live (Netlify)
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ CORS blocat pentru:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Conectare MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectat la MongoDB Atlas"))
  .catch((err) => console.error("❌ Eroare MongoDB:", err));

// ✅ Rute
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);

// ✅ Pornire server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
