// utils/smsLink.js
import axios from "axios";

const SMSLINK_BASE_URL =
  process.env.SMSLINK_BASE_URL?.trim() ||
  "https://secure.smslink.ro/sms/gateway/async_send.php";
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();

// 🔐 Stocare temporară OTP (în memorie)
const otpStore = {};

/* =======================================================
   📤 Trimite OTP rapid prin SMSLink (optimizat 07xxxxxxxx)
======================================================= */
export default async function sendOtpSMS(phone) {
  try {
    // Curățăm numărul: păstrăm doar cifre
    const cleanPhone = phone.replace(/[^\d]/g, "");

    // ✅ SMSLink vrea exact 10 cifre, format 07xxxxxxxx
    let formatted = cleanPhone.startsWith("4") ? cleanPhone.slice(1) : cleanPhone;

    console.log("📞 Număr primit:", phone);
    console.log("📞 După curățare:", formatted);

    // ✅ Validăm formatul — trebuie să fie 07xxxxxxxx
    if (!/^07\d{8}$/.test(formatted)) {
      console.error(`❌ Număr invalid pentru SMSLink: ${formatted}`);
      return {
        success: false,
        error: "Număr invalid (folosește formatul 07xxxxxxxx)",
      };
    }

    // 🔢 Generăm OTP random
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[formatted] = code;

    console.log(`📤 Trimitem OTP ${code} către ${formatted}`);

    // Construim URL-ul către SMSLink (folosim async_send pentru rapiditate)
    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: formatted,
      message: `Codul tău de autentificare Oltenita Imobiliare este ${code}. Nu divulga acest cod.`,
    });

    const url = `${SMSLINK_BASE_URL}?${params.toString()}`;
    console.log("🔗 URL SMSLink:", url);

    // 🔁 Trimitem cererea către SMSLink
    let res = await axios.get(url, { timeout: 7000 });

    // Dacă răspunsul conține eroare, încercăm o singură dată din nou
    if (!res.data || res.data.includes("ERROR")) {
      console.warn("⚠️ SMSLink a răspuns lent sau cu eroare, retry în 1s...");
      await new Promise((r) => setTimeout(r, 1000));
      res = await axios.get(url, { timeout: 7000 });
    }

    if (res.data && res.data.includes("ERROR")) {
      console.error("❌ SMSLink ERROR:", res.data);
      return { success: false, error: res.data };
    }

    console.log("✅ SMS trimis cu succes!");
    return { success: true };
  } catch (err) {
    console.error("❌ Eroare SMSLink:", err.message);
    return { success: false, error: err.message };
  }
}

/* =======================================================
   ✅ Verificare OTP local
======================================================= */
export async function verifyOtpSMS(phone, code) {
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const formatted = /^07\d{8}$/.test(cleanPhone)
    ? `4${cleanPhone}`
    : cleanPhone;

  const valid = otpStore[formatted] && otpStore[formatted] === code;
  if (valid) {
    delete otpStore[formatted];
    return { success: true };
  }
  return { success: false };
}
