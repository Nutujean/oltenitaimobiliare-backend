import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: "Acces refuzat: lipsă token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // salvez id-ul userului în req.user
    next();
  } catch (err) {
    res.status(403).json({ error: "Token invalid sau expirat" });
  }
};
