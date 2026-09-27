import dns from 'dns';
import net from 'net';

const lookup = dns.promises.lookup;
const addrs = await lookup('smtp.gmail.com', { all: true, verbatim: true });
console.log('DNS:', JSON.stringify(addrs));

async function tryConnect(host, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    const t = setTimeout(() => { s.destroy(); resolve('TIMEOUT'); }, timeoutMs);
    s.once('connect', () => { clearTimeout(t); s.end(); resolve('OPEN'); });
    s.once('error', (e) => { clearTimeout(t); resolve('ERR ' + e.code); });
    s.connect(port, host);
  });
}

for (const a of addrs) {
  const r587 = await tryConnect(a.address, 587);
  const r465 = await tryConnect(a.address, 465);
  console.log(`${a.address} (v${a.family}): 587=${r587} 465=${r465}`);
}
process.exit(0);
