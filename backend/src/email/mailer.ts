import dns from 'dns';
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

// Resend (transactional API) is the primary sender when configured;
// the Gmail SMTP transporter below stays as automatic fallback.
const resendKey = (process.env.RESEND_API_KEY || '').trim();
const resendFrom = (process.env.RESEND_FROM || '').trim() || from;

async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: resendFrom, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend rejected (${res.status}): ${await res.text()}`);
  const data: any = await res.json();
  return data.id || 'resend-accepted';
}

// Never send real email from automated tests.
const mailDisabled = process.env.EMAIL_DISABLED === 'true' || process.env.VITEST === 'true';

function buildTransporterSync(ipv4?: string): nodemailer.Transporter | null {
  if (!host || mailDisabled) return null;
  return nodemailer.createTransport({
    // Prefer a resolved IPv4 address (see getTransporter): IPv6 routes to
    // some SMTP hosts hang here, and this nodemailer version offers no
    // `family` option. `tls.servername` keeps cert verification on the hostname.
    host: ipv4 || host, port, secure: port === 465, auth: user ? { user, pass } : undefined,
    tls: ipv4 ? { servername: host } : undefined,
    // No connection pool: each email opens a fresh connection. A pooled idle
    // socket silently killed by NAT/Gmail caused "Connection timeout" on later
    // sends while a fresh connection worked fine.
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 25000,
  });
}

let transporter: nodemailer.Transporter | null = null;
let transporterReady: Promise<nodemailer.Transporter | null> | null = null;

/** Lazily build the transporter, resolving SMTP_HOST to IPv4 first. */
function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (!transporterReady) {
    transporterReady = (async () => {
      if (!host || mailDisabled) return null;
      try {
        const r = await dns.promises.lookup(host, { family: 4 });
        if (r?.address && r.address !== host) {
          console.log(`[email] using IPv4 ${r.address} for ${host}`);
          transporter = buildTransporterSync(r.address);
          return transporter;
        }
      } catch (e) {
        console.error(`[email] IPv4 lookup failed for ${host}, using hostname:`, (e as any)?.message || e);
      }
      transporter = buildTransporterSync();
      return transporter;
    })();
  }
  return transporterReady;
}

function resetTransporter() {
  try { transporter?.close(); } catch {}
  transporter = null;
  transporterReady = null;
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  const deliveredTo = redirectTo || to;
  const finalSubject = redirectTo ? `[for ${to}] ${subject}` : subject;
  const finalHtml = redirectTo ? `<p style="background:#fef3c7;padding:8px 12px;border-radius:8px"><b>Redirected mail — intended recipient: ${to}</b></p>` + html : html;
  const finalText = redirectTo ? `Redirected mail — intended recipient: ${to}\n\n${text}` : text;
  let t = await getTransporter();
  if (resendKey) {
    try {
      const id = await sendViaResend(deliveredTo, finalSubject, finalHtml, finalText);
      console.log(`[email] sent via resend to=${deliveredTo}`);
      return { messageId: id, stub: false as const, deliveredTo };
    } catch (e) {
      console.error(`[email] resend failed, falling back to SMTP:`, (e as any)?.message || e);
    }
  }
  if (!t) {
    console.log(`[email:stub] to=${deliveredTo} subject=${finalSubject}\n${text}`);
    return { messageId: `stub-${Date.now()}`, stub: true as const, deliveredTo };
  }
  const mail = { from, to: deliveredTo, subject: finalSubject, html: finalHtml, text: finalText };
  try {
    const info = await t.sendMail(mail);
    return { messageId: info.messageId, stub: false as const, deliveredTo };
  } catch (e) {
    // The connection may have died mid-flight — drop it and retry once fresh.
    resetTransporter();
    t = await getTransporter();
    try {
      const info = await t!.sendMail(mail);
      return { messageId: info.messageId, stub: false as const, deliveredTo };
    } catch (e2) {
      console.error(`[email] send failed to=${deliveredTo}:`, (e2 as any)?.message || e2);
      throw e2;
    }
  }
}

/** Where emails actually land (admin inbox when redirect is configured). */
export function mailCatcherInfo() {
  return { redirectTo: redirectTo || null };
}
