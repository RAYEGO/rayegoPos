import { loadEnvFile } from 'node:process';
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

loadEnvFile('.env.development');

const BASE = (process.env.VITE_API_BASE_URL && process.env.VITE_API_BASE_URL.startsWith('http'))
  ? process.env.VITE_API_BASE_URL
  : (process.env.VITE_PROXY_API_TARGET ?? 'http://127.0.0.1:4000');
const LOG_DIR = path.resolve('scripts', 'smoke', '.tmp');
mkdirSync(LOG_DIR, { recursive: true });
const LOG = path.join(LOG_DIR, 'roles-audit.log');
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const flush = () => writeFileSync(LOG, lines.join('\n'), 'utf8');

const login = async () => {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@rayego.pe',
        password: process.env.DEV_ADMIN_PASSWORD,
        remember: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: -1, data: { message: e?.message ?? String(e) } };
  }
};
const getRolePerms = async (token, role) => {
  try {
    const res = await fetch(`${BASE}/api/roles/${encodeURIComponent(role)}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: -1, data: { message: e?.message ?? String(e) } };
  }
};

const ROLES = [
  'ADMIN_POS','ADMIN_BOTICA','SUPERVISOR','CAJERO','ALMACEN','ADMIN_SERVICIO_TECNICO','TECNICO'
];

try {
  log(`[audit] API = ${BASE}`);
  const lr = await login();
  log(`LOGIN status=${lr.status} email=${lr.data?.user?.email ?? lr.data?.message ?? ''}`);
  const token = lr.data?.accessToken;
  if (!token) { log('NO TOKEN'); flush(); process.exit(1); }

  for (const role of ROLES) {
    const r = await getRolePerms(token, role);
    log(`\n### ROLE ${role} status=${r.status}`);
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.permisos)) {
      log(`BAD PAYLOAD: ${JSON.stringify(r.data).slice(0, 2000)}`);
      continue;
    }
    const codes = [...r.data.permisos].sort();
    log(`COUNT=${codes.length}`);
    log(`CODES:\n  - ${codes.join('\n  - ')}`);
  }
  flush();
  process.exit(0);
} catch (e) {
  log(`ERROR: ${e?.stack ?? e}`);
  flush();
  process.exit(1);
}
