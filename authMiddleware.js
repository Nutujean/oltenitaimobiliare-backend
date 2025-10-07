// middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

export default function auth(req, res, next) {
  try {
    const hdr = req.headers.authorization || req.headers.Authorization;
    if (!hdr) return res.status(401).json({ error: "Lipsește Authorization" });

    const parts = String(hdr).split(" ");
    const token =
      parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : String(hdr);

    try {
      const decoded = jwt.verify(token, JWT_SECRET); // { id, email, name, iat, exp }

      req.user = decoded;         // păstrăm tot obiectul
      req.userId = decoded.id;    // adăugăm shortcut pentru ID (important la verificare)

      return next();
    } catch (err) {
      console.error("JWT verify error:", err?.message);
      return res.status(401).json({ error: "Token invalid sau expirat" });
    }
  } catch {
    return res.status(500).json({ error: "Eroare autentificare" });
  }
}
