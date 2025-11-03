// middleware/upload.js
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// ✅ Conectare la Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Definim storage-ul pentru Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "oltenitaimobiliare", // numele foldărului din Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

// ✅ Inițializăm Multer cu configurarea Cloudinary
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB/poză
});

export default upload;
