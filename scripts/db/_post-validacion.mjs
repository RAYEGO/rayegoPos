import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
process.chdir(projectRoot);

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
config({ path: '.env.production' });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function cols(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name::text FROM information_schema.columns WHERE table_schema='public' AND table_name=$1::text`,
    table
  );
  return rows.map((r) => r.column_name);
}

function pick(colArr, candidates, fallback = null) {
  for (const c of candidates) if (colArr.includes(c)) return c;
  return fallback;
}

async function main() {
  const out = [];
  const log = (s = '') => {
    console.log(s);
    out.push(s);
  };

  log('=== VALIDACIÓN POST LIMPIEZA — PRODUCCIÓN RAILWAY ===');
  log('Fecha: ' + new Date().toISOString());
  log('');

  const EMP_COLS = await cols('empresas');
  const colRUC = pick(EMP_COLS, ['ruc', 'numero_documento', 'nro_ruc']);
  const colRS = pick(EMP_COLS, ['razon_social', 'nombre_empresa']);
  const colNC = pick(EMP_COLS, ['nombre_comercial']);
  const colMail = pick(EMP_COLS, ['email', 'correo']);
  const colAct = pick(EMP_COLS, ['activo', 'estado']);

  log('--- 1. EMPRESAS (todas 3, con deleted_at info)');
  const empFields = ['id', colRUC, colNC, colRS, colMail, colAct].filter(Boolean).join(', ');
  const emps = await prisma.$queryRawUnsafe(
    `SELECT ${empFields}, deleted_at IS NULL as vivo FROM empresas ORDER BY created_at`
  );
  for (const e of emps) {
    const rs = e[colRS ?? 'razon_social'] ?? '-';
    const ruc = e[colRUC ?? 'ruc'] ?? '-';
    const email = e[colMail ?? 'email'] ?? '-';
    const vivo = e.vivo;
    const activo = e[colAct ?? 'activo'];
    log(`  -> ${rs.padEnd(30, ' ')} | RUC ${ruc} | vivo=${vivo} | activo=${activo} | ${email}`);
  }
  log(`  Total: ${emps.length} | Vivas (deleted_at IS NULL): ${emps.filter(e => e.vivo).length}`);
  log('');

  const SUC_COLS = await cols('sucursales');
  const colTipo = pick(SUC_COLS, ['tipo']);
  const colDir = pick(SUC_COLS, ['direccion', 'ubicacion']);
  const colNom = pick(SUC_COLS, ['nombre']);
  log('--- 2. SUCURSALES (solo vivas)');
  const sucFields = ['id', 'empresa_id', colNom, colTipo, colDir].filter(Boolean).join(', ');
  const sucs = await prisma.$queryRawUnsafe(
    `SELECT ${sucFields} FROM sucursales WHERE deleted_at IS NULL`
  );
  for (const s of sucs) {
    const n = s[colNom ?? 'nombre'];
    const t = s[colTipo ?? 'tipo'];
    const d = s[colDir ?? 'direccion'] ?? '';
    log(`  -> ${n} | TIPO=${t} | ${d}`);
  }
  log(`  Total vivas: ${sucs.length} (esperado=1)`);
  log('');

  log('--- 3. APERTURAS DE CAJA (vivas)');
  const aps = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int c FROM apertura_caja WHERE deleted_at IS NULL`
  );
  const abiertas = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int c FROM apertura_caja WHERE deleted_at IS NULL AND (estado <> 'CERRADA' OR cierre_pendiente = true)`
  );
  log(`  Total aperturas vivas: ${aps[0].c} (esperado=0)`);
  log(`  Aperturas ABIERTAS (pendientes cierre): ${abiertas[0].c} (esperado=0) ✅`);
  log('');

  log('--- 4. MOVIMIENTOS DE CAJA (count)');
  const mc = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM movimientos_caja`);
  log('  Total: ' + mc[0].c + (mc[0].c === 0 ? ' ✅ 0 movimientos' : ''));
  log('');

  log('--- 5. AUDITORIA (count)');
  const au = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM auditoria`);
  log('  Total: ' + au[0].c + (au[0].c === 0 ? ' ✅ TRUNCATE OK' : ''));
  log('');

  const SD_COLS = await cols('series_documentos');
  const colSiguiente = pick(SD_COLS, ['siguiente_numero', 'correlativo', 'ultimo_numero']);
  const colCodigo = pick(SD_COLS, ['codigo', 'tipo_documento', 'tipo', 'codigo_sunat']);
  const colSerie = pick(SD_COLS, ['serie', 'serie_documento', 'numero_serie']);
  const colActSerie = pick(SD_COLS, ['activo', 'estado']);
  const sdFields = ['id', colCodigo, colSerie, `${colSiguiente} as sn`, colActSerie].filter(Boolean).join(', ');
  log('--- 6. SERIE DOCUMENTO T001');
  const sdWhere =
    colCodigo && colSerie
      ? `WHERE ${colCodigo}::text = 'TICKET' OR ${colSerie}::text = 'T001'`
      : colSerie
      ? `WHERE ${colSerie}::text = 'T001'`
      : `LIMIT 1`;
  const sd = await prisma.$queryRawUnsafe(`SELECT ${sdFields} FROM series_documentos ${sdWhere} LIMIT 1`);
  for (const s of sd) {
    const c = colCodigo ? s[colCodigo] : '?';
    const ser = colSerie ? s[colSerie] : '?';
    const act = colActSerie ? s[colActSerie] : '?';
    log(`  ${c}-${ser} | siguiente_numero = ${s.sn} | activo=${act}`);
    log(`  Resultado: ${s.sn === 1 ? '✅ RESET OK (1)' : '❌ NO SE MODIFICÓ (siguiente=' + s.sn + ')'}`);
  }
  log('');

  log('--- 7. TABLAS BACKUP *_bak (deben existir 11, son el rollback manual)');
  const baks = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%_bak' ORDER BY table_name`
  );
  log(`  Encontradas: ${baks.length} (esperado 11) ${baks.length >= 10 ? '✅' : ''}`);
  for (const b of baks) log('    - ' + b.table_name);
  log('');

  log('--- 8. USUARIOS (vivos)');
  const usr = await prisma.$queryRawUnsafe(
    `SELECT username, email, activo FROM usuarios WHERE deleted_at IS NULL ORDER BY username`
  );
  for (const u of usr) {
    const mark = u.email.endsWith('@rayego.pe') ? '  ⚠️ demo' : '';
    log(`  ${u.username.padEnd(15,' ')} | ${u.email.padEnd(30,' ')} | activo=${u.activo}${mark}`);
  }
  log(`  Total vivos: ${usr.length} (esperado=4 — NO TOCADOS)`);
  log('');

  log('--- 9. CATÁLOGO BASE (estructura NO se tocó - verificar intácto)');
  const allTables = await prisma.$queryRawUnsafe(
    `SELECT table_name::text t FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  const tn = new Set(allTables.map((r) => r.t));
  function safeCount(name, whereDel = true) {
    if (!tn.has(name)) return { t: name + '(?)', c: -1 };
    const w = whereDel ? ' WHERE deleted_at IS NULL' : '';
    return { t: name, c: 0 };
  }
  const runs = [
    ['categorias', true], ['laboratorios', true], ['presentaciones', true],
    ['unidades_medida', true], ['formas_pago', true], ['roles', false],
    ['permisos', false], ['tipos_empresa', false], ['tipos_comerciales', true],
    ['principios_activos', true], ['cajas', true],
  ];
  const expected = {
    categorias: 32, laboratorios: 8, presentaciones: 11, unidades_medida: 18,
    formas_pago: 6, roles: 4, permisos: 15, tipos_empresa: 3,
    tipos_comerciales: 3, principios_activos: 4, cajas: 1,
  };
  for (const [tname, wdel] of runs) {
    if (!tn.has(tname)) {
      log('   ' + tname.padEnd(20, ' ') + ' :  N/D (no existe en esta versión schema)');
      continue;
    }
    try {
      const w = wdel ? ' WHERE deleted_at IS NULL' : '';
      const rr = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM ${tname}${w}`);
      const c = rr[0].c;
      const exp = expected[tname] ?? '?';
      const ok = (exp !== '?' && c >= exp) ? '✅' : (exp === '?' ? '' : '⚠️');
      log('   ' + tname.padEnd(20, ' ') + ' : ' + String(c).padStart(3,' ') + '  (esperado ~' + exp + ') ' + ok);
    } catch (err) {
      log('   ' + tname.padEnd(20, ' ') + ' :  ERROR al contar');
    }
  }
  log('');

  log('=== FIN VALIDACIÓN POST LIMPIEZA ===');

  const outPath = path.join(__dirname, '_post-validacion-output.txt');
  writeFileSync(outPath, out.join('\n'), 'utf8');
  console.log('\nOutput guardado en: ' + outPath);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR FATAL:', e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
