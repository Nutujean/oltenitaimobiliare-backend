// utils/sendEmail.js
// Trimite emailuri prin Brevo HTTP API (fără SMTP/porturi)
const BREVO_API_KEY = process.env.BREVO_API_KEY; // setează în Render → Environment
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "Oltenița Imobiliare";
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL || "oltenitaimobiliare@gmail.com";

/**
 * Trimite un email
 * @param {{to:string, subject:string, html:string, replyTo?:string}} p
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!to) throw new Error("Missing 'to' address");
  if (!BREVO_API_KEY) throw new Error("Missing BREVO_API_KEY");

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    ...(replyTo ? { replyTo } : {}),
  };

  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.message || data?.error || `Brevo API error ${resp.status}`);
  }
  return data;
}
