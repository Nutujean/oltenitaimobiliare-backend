import axios from "axios";

/* =======================================================
   ✉️ SMSLink – Trimitere mesaje prin API
======================================================= */
const sendSMS = async (to, message) => {
  try {
    if (!process.env.SMSLINK_CONNECTION_ID || !process.env.SMSLINK_PASSWORD) {
      console.warn("⚠️ SMSLink ENV lipsă — mesajul nu va fi trimis!");
      return { success: false, warning: "Lipsă SMSLink ENV" };
    }

    const baseUrl =
      process.env.SMSLINK_BASE_URL ||
      "https://secure.smslink.ro/sms/gateway/communicate/index.php";

    const sender = process.env.SMSLINK_SENDER || "Oltenita";

    const params = new URLSearchParams({
      connection_id: process.env.SMSLINK_CONNECTION_ID,
      password: process.env.SMSLINK_PASSWORD,
      to,
      message,
      sender,
    });

    const { data } = await axios.post(baseUrl, params);
    console.log(`📤 SMSLink către ${to}:`, data);

    return { success: true, response: data };
  } catch (err) {
    console.error("❌ Eroare trimitere SMSLink:", err.message);
    return { success: false, error: err.message };
  }
};

export default sendSMS;
