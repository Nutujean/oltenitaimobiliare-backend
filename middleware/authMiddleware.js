// middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export default function authMiddleware(req, res, next) {
  // Acceptă token din:
  //  - Authorization: Bearer <token>
  //  - x-access-token (fallback, dacă vrei)
  const authHeader = req.headers.authorization || "";
  let token = null;

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.headers["x-access-token"]) {
    token = req.headers["x-access-token"];
  }

  if (!token) {
    return res.status(401).json({ error: "Lipsește tokenul de autentificare" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token invalid sau expirat" });
  }
}
