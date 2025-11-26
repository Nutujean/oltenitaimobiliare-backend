// src/utils/sendSMS.js
import sendOtpSMS from "./smsLink.js";

/**
 * Wrapper compatibil pentru vechiul sendSMS
 * Chiar dacă e apelat cu (phone, message),
 * folosim doar phone, restul e ignorat.
 */
export default async function sendSMS(phone, message) {
  try {
    // Folosim logica existentă din smsLink
    const result = await sendOtpSMS(phone);

    // Poți loga mesajul, dacă vrei:
    console.log("sendSMS wrapper -> phone:", phone, "message:", message);

    return result;
  } catch (err) {
    console.error("Eroare în sendSMS wrapper:", err);
    return { success: false, error: err.message || "Eroare sendSMS" };
  }
}
