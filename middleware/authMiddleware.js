import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  // 🔹 Extragem token-ul din header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: "Acces interzis. Lipsă token." });
  }

  try {
    // 🔹 Verificăm token-ul
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // punem userul în request
    next();
  } catch (err) {
    res.status(403).json({ message: "Token invalid sau expirat." });
  }
}
