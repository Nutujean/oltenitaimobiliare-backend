// utils/smsLink.js
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";

dotenv.config();

const {
  SMSLINK_CONNECTION_ID,
  SMSLINK_PASSWORD,
  SMSLINK_SENDER,
  SMSLINK_BASE_URL,
  APP_NAME,
  OTP_TTL_MINUTES,
} = process.env;

// 🧠 Verificăm că avem datele corecte din .env
console.log("🔍 SMSLink config:");
console.log("   📡 BASE_URL:", SMSLINK_BASE_URL);
console.log("   🆔 CONNECTION_ID:", SMSLINK_CONNECTION_ID ? "OK" : "NESETAT");
console.log("   🔑 PASSWORD:", SMSLINK_PASSWORD ? "OK" : "NESETAT");
console.log("   ✉️ SENDER:", SMSLINK_SENDER || "(implicit)");

/* =======================================================
   ✉️ Trimite SMS prin SMSLink API
======================================================= */
export async function sendSms({ to, message }) {
  try {
    if (!SMSLINK_BASE_URL || !SMSLINK_CONNECTION_ID || !SMSLINK_PASSWORD) {
      throw new Error("Lipsesc credențialele SMSLink din .env");
    }

    // 🧹 Curățăm și formăm numărul în format 407xxxxxxxx
    const cleanNumber = to.replace(/^0/, "4").replace(/\D/g, "");
    const encodedMsg = encodeURIComponent(message);

    // 🧩 Construim URL-ul de trimitere
    const url = `${SMSLINK_BASE_URL}?connection_id=${encodeURIComponent(
      SMSLINK_CONNECTION_ID
    )}&password=${encodeURIComponent(
      SMSLINK_PASSWORD
    )}&to=${encodeURIComponent(cleanNumber)}&from=${encodeURIComponent(
      SMSLINK_SENDER || "Oltenita"
    )}&message=${encodedMsg}`;

    console.log("🌐 URL SMSLink:", url);

    const { data } = await axios.get(url, { timeout: 15000 });
    console.log("📨 Răspuns SMSLink:", data);

    if (data.startsWith("ERROR")) throw new Error(data);
    return data;
  } catch (err) {
    console.error("❌ Eroare SMSLink:", err.message);
    throw new Error("Eroare la trimiterea SMS-ului");
  }
}

/* =======================================================
   🔢 Generare OTP (6 cifre)
======================================================= */
export function generateOtp(length = 6) {
  const n = crypto.randomInt(0, 10 ** length);
  return String(n).padStart(length, "0");
}

/* =======================================================
   🔐 Hash OTP pentru stocare sigură
======================================================= */
export function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}
