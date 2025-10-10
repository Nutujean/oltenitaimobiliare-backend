import jwt from "jsonwebtoken";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

/**
 * ✅ Middleware principal pentru protejarea rutelor (verifică token JWT)
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        return res.status(404).json({ message: "Utilizatorul nu există." });
      }

      return next();
    }

    return res.status(401).json({ message: "Acces neautorizat, fără token." });
  } catch (error) {
    console.error("Eroare protect middleware:", error);
    res.status(401).json({ message: "Token invalid sau expirat." });
  }
};

/**
 * 🔹 Middleware opțional pentru admin
 */
export const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: "Acces interzis - doar admin." });
  }
};

/**
 * 🔹 Export implicit (compatibilitate cu import auth)
 */
export default protect;
