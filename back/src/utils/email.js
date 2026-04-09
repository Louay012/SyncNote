import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

export function isEmailDeliveryEnabled() {
  return hasSmtpConfig();
}

async function getTransporter() {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass
      }
    });
  }

  return transporter;
}

function logEmailFallback({ to, subject, text }) {
  // eslint-disable-next-line no-console
  console.log("[SyncNote email fallback] SMTP is not configured. Email payload:");
  // eslint-disable-next-line no-console
  console.log(`To: ${to}`);
  // eslint-disable-next-line no-console
  console.log(`Subject: ${subject}`);
  // eslint-disable-next-line no-console
  console.log(text);
}

export async function sendTransactionalEmail({ to, subject, text, html }) {
  const mailer = await getTransporter();

  if (!mailer) {
    logEmailFallback({ to, subject, text });
    return false;
  }

  await mailer.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html
  });

  return true;
}

export function buildVerificationEmail({ name, verifyUrl }) {
  const safeName = String(name || "there");

  return {
    subject: "Verify your SyncNote account",
    text: [
      `Hi ${safeName},`,
      "",
      "Welcome to SyncNote.",
      "Please verify your email by opening the link below:",
      verifyUrl,
      "",
      "If you did not create this account, you can ignore this email."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f2536;">
        <h2 style="margin-bottom: 8px;">Welcome to SyncNote</h2>
        <p>Hi ${safeName},</p>
        <p>Please verify your email to activate your account:</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 10px 14px; border-radius: 8px; background: #d8eef8; color: #0f2536; text-decoration: none; border: 1px solid #0f2536;">
            Verify Email
          </a>
        </p>
        <p style="word-break: break-all;">${verifyUrl}</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `
  };
}

export function buildPasswordResetEmail({ name, resetUrl }) {
  const safeName = String(name || "there");

  return {
    subject: "Reset your SyncNote password",
    text: [
      `Hi ${safeName},`,
      "",
      "We received a request to reset your password.",
      "Use this link to set a new password:",
      resetUrl,
      "",
      "If you did not request this, you can safely ignore this email."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f2536;">
        <h2 style="margin-bottom: 8px;">Password Reset</h2>
        <p>Hi ${safeName},</p>
        <p>Use the button below to reset your password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 14px; border-radius: 8px; background: #d8eef8; color: #0f2536; text-decoration: none; border: 1px solid #0f2536;">
            Reset Password
          </a>
        </p>
        <p style="word-break: break-all;">${resetUrl}</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
  };
}
