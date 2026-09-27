import 'dotenv/config';
import { prisma } from './src/utils/prisma.js';

const logs = await prisma.emailLog.findMany({
  where: { status: 'FAILED' },
  orderBy: { sentAt: 'desc' },
  take: 5,
});
console.log(JSON.stringify(logs.map((l) => ({
  emailType: l.emailType,
  recipientEmail: l.recipientEmail,
  errorMessage: l.errorMessage,
  sentAt: l.sentAt,
})), null, 1));
await prisma.$disconnect();
process.exit(0);
