import axios from "axios";

// 🔐 Config din .env
const SMSLINK_BASE_URL = process.env.SMSLINK_BASE_URL?.trim();
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();

// 🕒 OTP-urile sunt stocate temporar (memorie locală)
const otpStore = {};
const otpRequests = {}; // pentru limitare per număr

/* =======================================================
   📤 Trimite OTP rapid prin SMSLink (format 07xxxxxxxx)
======================================================= */
export default async function sendOtpSMS(phone) {
  try {
    // Curățăm numărul — doar cifre
    const cleanPhone = phone.replace(/[^\d]/g, "");
    let formatted = cleanPhone.startsWith("4") ? cleanPhone.slice(1) : cleanPhone;

    console.log("📞 Număr primit:", phone);
    console.log("📞 După curățare:", formatted);

    // ✅ Validăm formatul (07xxxxxxxx)
    if (!/^07\d{8}$/.test(formatted)) {
      console.error(`❌ Număr invalid pentru SMSLink: ${formatted}`);
      return {
        success: false,
        error: "Număr invalid (folosește formatul 07xxxxxxxx)",
      };
    }

    // 🔒 LIMITARE cereri: max 3/min
    const now = Date.now();
    otpRequests[formatted] = otpRequests[formatted] || [];
    otpRequests[formatted] = otpRequests[formatted].filter(
      (t) => now - t < 60 * 1000
    );

    if (otpRequests[formatted].length >= 3) {
      console.warn(`🚫 Prea multe cereri OTP pentru ${formatted}`);
      return {
        success: false,
        error: "Prea multe cereri. Încearcă din nou peste 1 minut.",
      };
    }

    otpRequests[formatted].push(now);

    // 🔢 Generăm cod OTP (6 cifre)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[formatted] = {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // expiră în 5 min
    };

    console.log(`📤 Trimitem OTP ${code} către ${formatted}`);

    // Construim URL-ul pentru SMSLink
    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: formatted,
      message: `Codul tău de autentificare Oltenita Imobiliare este ${code}. Nu divulga acest cod.`,
    });

    const url = `${SMSLINK_BASE_URL}?${params.toString()}`;
    console.log("🔗 URL SMSLink:", url);

    let res = await axios.get(url, { timeout: 7000 });

    // Retry o dată dacă apare o eroare
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
   ✅ Verificare OTP local (cu expirare automată)
======================================================= */
export async function verifyOtpSMS(phone, code) {
  let cleanPhone = phone.replace(/[^\d]/g, "");
  if (cleanPhone.startsWith("4")) cleanPhone = cleanPhone.slice(1);

  console.log("🔍 Verificare OTP pentru:", cleanPhone, "cod:", code);

  const entry = otpStore[cleanPhone];

  if (!entry) {
    console.warn("❌ OTP inexistent pentru acest număr.");
    return { success: false };
  }

  if (Date.now() > entry.expiresAt) {
    console.warn("⚠️ OTP expirat — șters automat.");
    delete otpStore[cleanPhone];
    return { success: false };
  }

  if (entry.code === code) {
    console.log("✅ OTP valid — autentificare reușită!");
    delete otpStore[cleanPhone];
    return { success: true };
  }

  console.warn("❌ OTP incorect!");
  return { success: false };
}

/* =======================================================
   🧹 Curățare automată OTP-uri și loguri expirate
======================================================= */
setInterval(() => {
  const now = Date.now();

  // Curățăm OTP-urile expirate
  for (const [phone, data] of Object.entries(otpStore)) {
    if (data.expiresAt < now) {
      delete otpStore[phone];
      console.log(`🧹 Șters OTP expirat pentru ${phone}`);
    }
  }

  // Curățăm istoricul cererilor vechi
  for (const [phone, timestamps] of Object.entries(otpRequests)) {
    otpRequests[phone] = timestamps.filter((t) => now - t < 60 * 1000);
  }
}, 2 * 60 * 1000);
