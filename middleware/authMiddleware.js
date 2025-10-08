// middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

export default function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // 🔴 dacă lipsește headerul complet
    if (!authHeader) {
      return res.status(401).json({ error: "Nu ești autentificat." });
    }

    // 🔹 extragem tokenul
    const tokenParts = authHeader.split(" ");
    const token =
      tokenParts.length === 2 && /^Bearer$/i.test(tokenParts[0])
        ? tokenParts[1]
        : authHeader;

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ error: "Token lipsă sau invalid." });
    }

    // 🔹 verificăm validitatea tokenului
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error("❌ Token invalid:", err.message);
      return res.status(401).json({ error: "Token invalid sau expirat." });
    }

    // ✅ salvăm user-ul în req.user
    req.user = decoded;

    // mergem mai departe
    next();
  } catch (err) {
    console.error("Eroare în middleware auth:", err.message);
    return res.status(500).json({ error: "Eroare la autentificare." });
  }
}
