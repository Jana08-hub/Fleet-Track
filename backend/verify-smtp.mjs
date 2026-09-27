import dns from 'dns';
import 'dotenv/config';
import nodemailer from 'nodemailer';

// Mirrors src/email/mailer.ts: resolves SMTP_HOST to IPv4 first, because
// direct IPv6 routes to some SMTP hosts hang from this network.
const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
let resolved = host;
try {
  const r = await dns.promises.lookup(host, { family: 4 });
  if (r?.address && r.address !== host) {
    console.log(`[verify] using IPv4 ${r.address} for ${host}`);
    resolved = r.address;
  }
} catch (e) {
  console.log(`[verify] IPv4 lookup failed, using hostname: ${e.message}`);
}

const t = nodemailer.createTransport({
  host: resolved,
  port,
  secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  tls: resolved !== host ? { servername: host } : undefined,
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 25000,
});
try {
  await t.verify();
  console.log('SMTP OK — connection and login succeeded');
} catch (e) {
  console.log('SMTP FAIL:', e.message);
}
process.exit(0);
