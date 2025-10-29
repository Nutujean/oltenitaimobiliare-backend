import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/* =======================================================
   ⚙️ CONFIGURARE SMSLINK
======================================================= */
const SMSLINK_BASE_URL =
  process.env.SMSLINK_BASE_URL ||
  "https://secure.smslink.ro/sms/gateway/communicate/index.php";
const SMSLINK_CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID;
const SMSLINK_PASSWORD = process.env.SMSLINK_PASSWORD;
const SMSLINK_SENDER = process.env.SMSLINK_SENDER || "Oltenita";

/* =======================================================
   🧠 STOCARE CODURI TEMPORARE
======================================================= */
const otpStore = new Map(); // phone -> { code, expires }

/* =======================================================
   🧩 FUNCȚIE: trimite SMS OTP
======================================================= */
export async function sendOtpSMS(phone) {
  try {
    if (!SMSLINK_CONNECTION_ID || !SMSLINK_PASSWORD) {
      console.error("❌ SMSLink nu este configurat corect în .env");
      return { success: false, error: "Config SMSLink lipsă" };
    }

    // cod random 6 cifre
    const code = Math.floor(100000 + Math.random() * 900000);
    const message = `Codul tău de autentificare este: ${code}`;

    // trimite cererea către SMSLink
    const params = new URLSearchParams({
      connection_id: SMSLINK_CONNECTION_ID,
      password: SMSLINK_PASSWORD,
      to: phone,
      message,
      sender: SMSLINK_SENDER,
    });

    const response = await axios.post(SMSLINK_BASE_URL, params);
    console.log("📤 SMSLink răspuns:", response.data);

    // salvează OTP local (valabil 5 minute)
    otpStore.set(phone, { code: code.toString(), expires: Date.now() + 5 * 60 * 1000 });

    return { success: true };
  } catch (err) {
    console.error("❌ Eroare SMSLink:", err.message);
    return { success: false, error: "Eroare trimitere SMS" };
  }
}

/* =======================================================
   🧩 FUNCȚIE: verifică OTP
======================================================= */
export async function verifyOtpSMS(phone, code) {
  const entry = otpStore.get(phone);
  if (!entry) return { success: false, error: "Codul nu există sau a expirat." };

  if (Date.now() > entry.expires) {
    otpStore.delete(phone);
    return { success: false, error: "Codul a expirat." };
  }

  if (entry.code !== code.toString()) {
    return { success: false, error: "Cod incorect." };
  }

  // verificare reușită — ștergem codul
  otpStore.delete(phone);
  return { success: true };
}

/* =======================================================
   🧾 INFO CONFIG LA PORNIRE (DOAR PENTRU DEBUG)
======================================================= */
console.log("🔍 SMSLink config:");
console.log("   📡 BASE_URL:", SMSLINK_BASE_URL || "❌ lipsă");
console.log("   🆔 CONNECTION_ID:", SMSLINK_CONNECTION_ID ? "OK" : "❌ lipsă");
console.log("   🔑 PASSWORD:", SMSLINK_PASSWORD ? "OK" : "❌ lipsă");
console.log("   ✉️ SENDER:", SMSLINK_SENDER);
