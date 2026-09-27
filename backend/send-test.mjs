import 'dotenv/config';
import { sendMail } from './src/email/mailer.js';

try {
  const r = await sendMail('mailer-selftest@example.com', 'FleetTrack mail self-test', '<p>self-test</p>', 'self-test');
  console.log('SEND OK:', JSON.stringify(r));
} catch (e) {
  console.log('SEND FAIL:', e.message);
}
process.exit(0);
