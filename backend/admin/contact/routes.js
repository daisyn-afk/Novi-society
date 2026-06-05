import { Router } from "express";
import {
  buildCourseStyleEmailHtml,
  escapeEmailHtml,
  sendResendHtmlEmail,
} from "../emails/courseStyleEmail.js";

export const contactRouter = Router();

const SUPPORT_EMAIL = "support@novisociety.com";

contactRouter.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const subject = String(body.subject || "").trim() || "General Inquiry";
    const message = String(body.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Name, email, and message are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email address." });
    }

    const emailSubject = `Contact Form: ${subject} — ${name}`;
    const bodyHtml = `
      <p><strong>Name:</strong> ${escapeEmailHtml(name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeEmailHtml(email)}">${escapeEmailHtml(email)}</a></p>
      <p><strong>Phone:</strong> ${escapeEmailHtml(phone || "N/A")}</p>
      <p><strong>Subject:</strong> ${escapeEmailHtml(subject)}</p>
      <p style="margin-top:16px"><strong>Message:</strong></p>
      <p style="white-space:pre-wrap;line-height:1.6">${escapeEmailHtml(message)}</p>
    `;

    const html = buildCourseStyleEmailHtml({
      greetingName: "NOVI Support",
      bodyHtml,
      includeSignoff: false,
    });

    const result = await sendResendHtmlEmail({
      to: SUPPORT_EMAIL,
      subject: emailSubject,
      html,
    });

    if (!result.ok) {
      const status = result.error === "missing_resend_key" ? 503 : 502;
      return res.status(status).json({
        ok: false,
        error:
          result.error === "missing_resend_key"
            ? "Email service is not configured."
            : "Could not send your message. Please try again or email support@novisociety.com directly.",
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
