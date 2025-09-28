import multer from "multer";

// Folosim memoryStorage ca să putem trimite buffer-ul direct la Cloudinary
const storage = multer.memoryStorage();

// Permitem upload pentru maxim 10 imagini simultan
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // limită 5MB pe fișier
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg"
    ) {
      cb(null, true);
    } else {
      cb(new Error("❌ Doar fișiere .jpg și .png sunt permise!"), false);
    }
  },
});

export default upload;
