import axios from "axios";

const SMSLINK_BASE_URL = process.env.SMSLINK_BASE_URL?.trim();
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();

// 🕒 OTP-urile vor fi stocate temporar în memorie
const otpStore = {};

function cleanSmsPhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "").replace(/^4/, "");
}

async function sendSmsLinkMessage(phone, message) {
  try {
    const cleanPhone = cleanSmsPhone(phone);

    if (!/^07\d{8}$/.test(cleanPhone)) {
      console.error(`❌ Număr invalid pentru SMSLink: ${cleanPhone}`);
      return { success: false, error: "Număr invalid (folosește formatul 07xxxxxxxx)" };
    }

    if (!SMSLINK_BASE_URL || !CONNECTION_ID || !PASSWORD) {
      console.error("❌ Config SMSLink lipsă în .env");
      return { success: false, error: "Config SMSLink lipsă." };
    }

    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: cleanPhone.slice(-10),
      message: String(message || "").slice(0, 320),
    });

    const url = `${SMSLINK_BASE_URL}?${params.toString()}`;
    const res = await axios.get(url);

    if (String(res.data).includes("ERROR")) {
      console.error("❌ SMSLink ERROR:", res.data);
      return { success: false, error: res.data };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ Eroare SMSLink:", err.message);
    return { success: false, error: err.message };
  }
}

/* =======================================================
   📤 Trimite OTP prin SMSLink (fără sender explicit)
======================================================= */
export default async function sendOtpSMS(phone) {
  const cleanPhone = cleanSmsPhone(phone);

  // Generăm codul OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[cleanPhone] = code;

  console.log(`📤 SMSLink OTP către ${cleanPhone}: cod ${code}`);

  return sendSmsLinkMessage(
    cleanPhone,
    `oltenitaimobiliare.ro - Codul tau de verificare este ${code}. Valabil 5 minute.`
  );
}

/* =======================================================
   📣 Trimite SMS notificare anunț
======================================================= */
export async function sendListingNotificationSMS(phone, message) {
  return sendSmsLinkMessage(phone, message);
}

/* =======================================================
   ✅ Verificare OTP local
======================================================= */
export async function verifyOtpSMS(phone, code) {
  const cleanPhone = cleanSmsPhone(phone);
  const valid = otpStore[cleanPhone] && otpStore[cleanPhone] === code;

  if (valid) {
    delete otpStore[cleanPhone];
    return { success: true };
  }

  return { success: false };
}
