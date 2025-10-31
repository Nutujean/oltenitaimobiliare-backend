import axios from "axios";
import Otp from "../models/Otp.js";

const SMSLINK_BASE_URL = process.env.SMSLINK_BASE_URL?.trim();
const CONNECTION_ID = process.env.SMSLINK_CONNECTION_ID?.trim();
const PASSWORD = process.env.SMSLINK_PASSWORD?.trim();

function to07(value = "") {
  let d = String(value).replace(/\D/g, "");
  if (d.startsWith("00407")) d = d.slice(3);
  if (d.startsWith("407")) d = d.slice(1);
  return (d.startsWith("07") && d.length === 10) ? d : null;
}

export default async function sendOtpSMS(phone) {
  try {
    const n07 = to07(phone);
    if (!n07) return { success: false, error: "Număr invalid (07xxxxxxxx)" };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { phone: n07 },
      { code, createdAt: new Date() },
      { upsert: true }
    );

    const params = new URLSearchParams({
      connection_id: CONNECTION_ID,
      password: PASSWORD,
      to: n07, // << IMPORTANT: 07xxxxxxxx
      message: `Codul tău de autentificare Oltenita Imobiliare este ${code}. Nu divulga acest cod.`,
    });

    const url = `${SMSLINK_BASE_URL}?${params.toString()}`;
    const res = await axios.get(url);
    if (res.data.includes("ERROR")) return { success: false, error: res.data };
    return { success: true };
  } catch (err) {
    console.error("❌ Eroare SMSLink:", err.message);
    return { success: false, error: err.message };
  }
}

export async function verifyOtpSMS(phone, code) {
  const n07 = to07(phone);
  if (!n07) return { success: false };

  const otp = await Otp.findOne({ phone: n07 });
  if (otp && otp.code === code) {
    await Otp.deleteOne({ phone: n07 });
    return { success: true };
  }
  return { success: false };
}
