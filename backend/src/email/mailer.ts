import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const port = Number(process.env.SMTP_PORT || 587);
const from = process.env.EMAIL_FROM || 'FleetTrack <no-reply@fleettrack.example>';

// Global mail catcher: when set, EVERY outgoing email is delivered to this
// address instead of its original recipient (subject/body note who it was for).
// Used so the administrator receives all mails in one inbox.
const redirectTo = (process.env.EMAIL_REDIRECT_TO || '').trim();

let transporter: nodemailer.Transporter | null = null;
// Never send real email from automated tests.
const mailDisabled = process.env.EMAIL_DISABLED === 'true' || process.env.VITEST === 'true';
if (host && !mailDisabled) {
  transporter = nodemailer.createTransport({
    host, port, secure: port === 465, auth: user ? { user, pass } : undefined,
    // Connection pool: reuse TLS sessions instead of re-handshaking per email.
    pool: true, maxConnections: 3, maxMessages: 100,
    // Fail fast instead of hanging API requests when the SMTP host hiccups.
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 25000,
  });
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  const deliveredTo = redirectTo || to;
  const finalSubject = redirectTo ? `[for ${to}] ${subject}` : subject;
  const finalHtml = redirectTo ? `<p style="background:#fef3c7;padding:8px 12px;border-radius:8px"><b>Redirected mail — intended recipient: ${to}</b></p>` + html : html;
  const finalText = redirectTo ? `Redirected mail — intended recipient: ${to}\n\n${text}` : text;
  if (!transporter) {
    console.log(`[email:stub] to=${deliveredTo} subject=${finalSubject}\n${text}`);
    return { messageId: `stub-${Date.now()}`, stub: true as const, deliveredTo };
  }
  const info = await transporter.sendMail({ from, to: deliveredTo, subject: finalSubject, html: finalHtml, text: finalText });
  return { messageId: info.messageId, stub: false as const, deliveredTo };
}

/** Where emails actually land (admin inbox when redirect is configured). */
export function mailCatcherInfo() {
  return { redirectTo: redirectTo || null };
}
