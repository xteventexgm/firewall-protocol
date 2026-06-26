/**
 * Envío de correos (SMTP). Sin SMTP configurado, registra el enlace en logs (desarrollo).
 */
import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import type { Transporter } from 'nodemailer';
import {
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  buildDeleteAccountEmailHtml,
  buildDeleteAccountEmailText,
  buildVerificationEmailHtml,
  buildVerificationEmailText,
} from '../emails/emailTemplates';
import {
  getPublicAppBaseUrl,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from '../config/env';
import { resolveBrandIconPath } from '../utils/brandAssets';
import { logger } from '../utils/logger';

const LOGO_CID = 'fp-logo';

let transporter: Transporter | null = null;
let logoAttachment: Attachment | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_FROM);
}

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function getLogoAttachment(): Attachment | undefined {
  if (logoAttachment) return logoAttachment;
  const logoPath = resolveBrandIconPath();
  if (!logoPath) {
    logger.warn('[email] logo no encontrado (assets/icon.png)');
    return undefined;
  }
  logoAttachment = {
    filename: 'icon.png',
    path: logoPath,
    cid: LOGO_CID,
  };
  return logoAttachment;
}

async function sendMail(
  to: string,
  subject: string,
  text: string,
  html: string,
  withLogo = true,
): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    logger.warn('[email] SMTP no configurado — mensaje no enviado', { to, subject, text });
    return;
  }
  const attachments = withLogo ? ([getLogoAttachment()].filter(Boolean) as Attachment[]) : [];
  await transport.sendMail({ from: SMTP_FROM, to, subject, text, html, attachments });
}

function verifyLink(token: string): string {
  const base = getPublicAppBaseUrl();
  return `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
): Promise<void> {
  const link = verifyLink(token);
  const subject = '🔐 Verifica tu cuenta — Firewall Protocol';
  const text = buildVerificationEmailText(username, link, token);
  const html = buildVerificationEmailHtml(username, link, token);
  await sendMail(email, subject, text, html);
  if (!isEmailConfigured()) {
    logger.info('[email] verify link (dev)', { email, link, publicBase: getPublicAppBaseUrl() });
  }
}

export async function sendPasswordResetEmail(
  email: string,
  username: string,
  token: string,
): Promise<void> {
  const subject = '🔑 Recuperar contraseña — Firewall Protocol';
  const text = buildPasswordResetEmailText(username, token);
  const html = buildPasswordResetEmailHtml(username, token);
  await sendMail(email, subject, text, html);
  if (!isEmailConfigured()) {
    logger.info('[email] reset token (dev)', { email, token });
  }
}

export async function sendDeleteAccountEmail(
  email: string,
  username: string,
  token: string,
): Promise<void> {
  const subject = '⚠ Eliminar cuenta — Firewall Protocol';
  const text = buildDeleteAccountEmailText(username, token);
  const html = buildDeleteAccountEmailHtml(username, token);
  await sendMail(email, subject, text, html);
  if (!isEmailConfigured()) {
    logger.info('[email] delete account token (dev)', { email, token });
  }
}
