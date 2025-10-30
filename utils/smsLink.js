import axios from "axios";

const SMSLINK_BASE_URL = process.env.SMSLINK_BASE_URL?.trim();
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();
const SENDER = process.env.SMSLINK_SENDER?.trim() || "Oltenita";

// 🕒 OTP-urile vor fi stocate temporar în memorie
const otpStore = {};

export default async function sendOtpSMS(phone) {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[phone] = code;

    console.log(`📤 SMSLink către ${phone}: cod ${code}`);

    // ✅ Construim URL-ul corect și 100% encodat
    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: phone,
      message: `Codul tău de autentificare este ${code}. (Oltenita Imobiliare)`,
      sender: SENDER,
    });

    const url = `${SMSLINK_BASE_URL}?${params.toString()}`;
    console.log("🔗 URL SMSLink:", url);

    const res = await axios.get(url);

    if (res.data.includes("ERROR")) {
      console.error("❌ SMSLink ERROR:", res.data);
      return { success: false, error: res.data };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ Eroare SMSLink:", err.message);
    return { success: false, error: err.message };
  }
}

export async function verifyOtpSMS(phone, code) {
  const valid = otpStore[phone] && otpStore[phone] === code;
  if (valid) {
    delete otpStore[phone];
    return { success: true };
  }
  return { success: false };
}
