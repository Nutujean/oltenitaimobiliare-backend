import axios from "axios";

const SMSLINK_BASE_URL = process.env.SMSLINK_BASE_URL?.trim();
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();

// 🕒 OTP-urile vor fi stocate temporar în memorie
const otpStore = {};

/* =======================================================
   📤 Trimite OTP prin SMSLink (fără sender explicit)
======================================================= */
export default async function sendOtpSMS(phone) {
  try {
    // Curățăm numărul — doar cifre
    const cleanPhone = phone.replace(/[^\d]/g, "");
    console.log("📞 Număr primit în backend:", phone);
    console.log("📞 După curățare:", cleanPhone);

    // SMSLink cere format: 07xxxxxxxx (10 cifre)
    if (!/^(07\d{8}|407\d{8})$/.test(cleanPhone)) {
     console.error(`❌ Număr invalid pentru SMSLink: ${cleanPhone}`);
     return { success: false, error: "Număr invalid (folosește formatul 07xxxxxxxx sau 407xxxxxxxx)" };
   }

    // Generăm codul OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[cleanPhone] = code;

    console.log(`📤 SMSLink către ${cleanPhone}: cod ${code}`);

    // ✅ Construim URL-ul corect, fără sender
    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: cleanPhone,
      message: `Codul tău de autentificare este ${code}. (Oltenita Imobiliare)`,
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

/* =======================================================
   ✅ Verificare OTP local
======================================================= */
export async function verifyOtpSMS(phone, code) {
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const valid = otpStore[cleanPhone] && otpStore[cleanPhone] === code;

  if (valid) {
    delete otpStore[cleanPhone];
    return { success: true };
  }

  return { success: false };
}
