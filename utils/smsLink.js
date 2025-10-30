import axios from "axios";
import Otp from "../models/Otp.js";

const SMSLINK_BASE_URL = process.env.SMSLINK_BASE_URL?.trim();
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();

/* =======================================================
   📤 Trimite OTP prin SMSLink și salvează în MongoDB
======================================================= */
export default async function sendOtpSMS(phone) {
  try {
    const cleanPhone = phone.replace(/[^\d]/g, "");

    // ✅ SMSLink acceptă doar formatul 07xxxxxxxx
    if (!/^(07\d{8})$/.test(cleanPhone)) {
      console.error(`❌ Număr invalid pentru SMSLink: ${cleanPhone}`);
      return { success: false, error: "Număr invalid (folosește formatul 07xxxxxxxx)" };
    }

    // ✅ Generăm codul OTP și îl salvăm în MongoDB
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { phone: cleanPhone },
      { code, createdAt: new Date() },
      { upsert: true }
    );

    console.log(`📞 Trimitem OTP către: ${cleanPhone} → cod ${code}`);

    // ✅ Trimitem SMS-ul prin API
    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: cleanPhone,
      message: `Codul tău de autentificare Oltenita Imobiliare este ${code}. Nu divulga acest cod.`,
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
   ✅ Verificare OTP — verificăm codul din MongoDB
======================================================= */
export async function verifyOtpSMS(phone, code) {
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const otp = await Otp.findOne({ phone: cleanPhone });

  if (otp && otp.code === code) {
    await Otp.deleteOne({ phone: cleanPhone }); // șterge codul după folosire
    return { success: true };
  }

  return { success: false };
}
