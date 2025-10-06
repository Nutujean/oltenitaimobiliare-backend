// utils/sendEmail.js
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
} = process.env;

// Transport prin Brevo (sau alt SMTP) pe 587 cu STARTTLS
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(SMTP_PORT || 587),
  secure: false, // pe 587 folosim STARTTLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

/**
 * Trimite un email
 * @param {{to:string, subject:string, html:string, replyTo?:string}} param0
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!to) throw new Error("Missing 'to' address");
  return transporter.sendMail({
    from: MAIL_FROM || `Oltenița Imobiliare <${SMTP_USER}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}
