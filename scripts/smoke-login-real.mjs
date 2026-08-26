const API_ROOT = 'http://127.0.0.1:4000'

async function login(email, password, label) {
  const start = Date.now()
  try {
    const res = await fetch(`${API_ROOT}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const ms = Date.now() - start
    const body = await res.text()
    let parsed = body
    try { parsed = JSON.parse(body) } catch { /* ignore */ }
    const token = parsed && typeof parsed === 'object' && parsed.token ? parsed.token : null
    const companyId = parsed?.user?.companyId ?? parsed?.companyId ?? null
    const roles = parsed?.user?.roles ?? parsed?.roles ?? null
    const enabledModules = parsed?.user?.enabledModules ?? parsed?.enabledModules ?? null
    console.log(`\n[${label}] ${res.status} ${res.statusText} (${ms}ms)`)
    console.log(`  token present: ${!!token} | token preview: ${token ? token.slice(0, 40) + '…' : 'NONE'}`)
    console.log(`  companyId: ${JSON.stringify(companyId)} | roles: ${JSON.stringify(roles)}`)
    if (enabledModules && Array.isArray(enabledModules)) {
      console.log(`  enabledModules count: ${enabledModules.length} | [${enabledModules.slice(0, 10).join(',')}${enabledModules.length > 10 ? '...' : ''}]`)
    } else {
      console.log(`  enabledModules: ${JSON.stringify(enabledModules)}`)
    }
    if (res.status !== 200) {
      console.log(`  body preview: ${body.slice(0, 400)}`)
    }
    return { status: res.status, token, parsed }
  } catch (error) {
    console.log(`\n[${label}] EXCEPTION: ${error.message}`)
    return { status: -1 }
  }
}

async function main() {
  console.log(`>> Smoke test login real (DB real Supabase — no mock)\n   API: ${API_ROOT}`)
  await login('admin.pos@rayego.pe', 'RayegoPOS2026!', 'ADMIN_POS (global, no empresa)')
  await login('admin@rayego.pe', 'RayegoPOS2026!', 'ADMIN (1 empresa Botica)')
  await login('supervisor@rayego.pe', 'RayegoSupervisor2026!', 'SUPERVISOR (empresa+branch)')
  await login('caja@rayego.pe', 'RayegoCaja2026!', 'CAJERO (empresa+branch)')
  await login('noexisto@rayego.pe', 'Nada', 'Credenciales inválidas')
  console.log(`\n>> DONE smoke test.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
