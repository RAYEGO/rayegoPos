import process from 'node:process'

const API_BASE =
  (process.env.VITE_API_BASE_URL && process.env.VITE_API_BASE_URL.startsWith('http'))
    ? process.env.VITE_API_BASE_URL
    : process.env.VITE_PROXY_API_TARGET ?? 'http://127.0.0.1:4000'
console.log('[smoke] API resolved =', API_BASE)

/**
 * @param {string} username
 * @param {string} password
 * @param {string} [branchId]
 */
async function login(username, password, branchId) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: username,
        password,
        remember: false,
        ...(branchId ? { branchId } : {}),
      }),
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  } catch (e) {
    return { status: -1, data: { message: e?.message ?? String(e) } }
  }
}

/**
 * @param {string} label
 * @param {() => Promise<void>} fn
 */
async function test(label, fn) {
  console.log(`\n=== ${label} ===`)
  try {
    await fn()
    console.log(`✓ ${label} OK`)
  } catch (e) {
    console.error(`✗ ${label} FALLO:`, e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}

void (async () => {
  await test('CAJERO (1 sucursal PRINCIPAL) → login directo sin selector', async () => {
    const { status, data } = await login('caja@rayego.pe', 'RayegoCaja2026!')
    console.log('status:', status, 'keys:', Object.keys(data))
    if (status !== 200) throw new Error('HTTP ' + status + ': ' + data.message)
    if (data.requiresBranchSelection) {
      throw new Error('No debió pedir selector de sucursal (solo 1 sucursal)')
    }
    if (!data.accessToken) throw new Error('No hay accessToken')
    const user = data.user ?? {}
    console.log('  user.branchName:', user.branchName, 'user.branchId:', user.branchId)
    if (!user.branchId) throw new Error('branchId no seteado')
  })

  await test('SUPERVISOR (2 sucursales) → selector sucursal response', async () => {
    const { status, data } = await login('supervisor@rayego.pe', 'RayegoSupervisor2026!')
    console.log('status:', status, 'keys:', Object.keys(data))
    if (status !== 200) throw new Error('HTTP ' + status + ': ' + data.message)
    if (!data.requiresBranchSelection) {
      throw new Error('Debió pedir selector de sucursal (tiene 2)')
    }
    const branches = data.branches ?? []
    console.log('  branches:', branches.map((b) => b.name ?? b.nombre))
    if (branches.length !== 2) throw new Error('Se esperaban 2 sucursales, llegó ' + branches.length)
  })

  await test('ADMIN (2 sucursales) → selector + login con branchId elegido OK', async () => {
    const { status, data } = await login('admin@rayego.pe', 'RayegoPOS2026!')
    console.log('status:', status, 'keys:', Object.keys(data))
    if (status !== 200) throw new Error('HTTP ' + status + ': ' + data.message)
    if (!data.requiresBranchSelection) {
      throw new Error('Debió pedir selector de sucursal (tiene 2)')
    }
    const branches = data.branches ?? []
    console.log('  branches:', branches.map((b) => b.name ?? b.nombre))
    if (branches.length !== 2) throw new Error('Se esperaban 2 sucursales, llegó ' + branches.length)
    const b2 = branches[1]
    const { status: s2, data: d2 } = await login('admin@rayego.pe', 'RayegoPOS2026!', b2.id)
    console.log('  admin login + branchId elegido status:%s user.branchName:', s2, d2.user?.branchName)
    if (s2 !== 200) throw new Error('HTTP ' + s2 + ': ' + d2.message)
    if (d2.requiresBranchSelection) throw new Error('Ya eligió branch, no debe pedir selector')
    if (d2.user?.branchId !== b2.id) throw new Error('branchId no coincide')
  })

  await test('ADMIN con branchId inexistente → backend NO confía en frontend, rechaza', async () => {
    const { status, data } = await login('admin@rayego.pe', 'RayegoPOS2026!', '00000000-0000-0000-0000-000000000000')
    console.log('  status:', status, 'msg:', data.message)
    if (status === 200) throw new Error('Debió rechazar branchId inexistente, respondió 200')
  })

  await test('Usuario sin sucursales → HTTP 409 con mensaje explícito', async () => {
    const { status, data } = await login('sin.sucursal@rayego.pe', 'DemoSinSucursal123!')
    console.log('  status:', status, 'msg:', data.message)
    if (status !== 409) throw new Error('Esperado 409, llegó ' + status)
    const msg = (data.message ?? '').toString()
    if (!msg.toLowerCase().includes('sucursal asignada')) {
      throw new Error('Mensaje no menciona "sucursal asignada": ' + msg)
    }
  })

  console.log('\n=== Smoke tests login branches completados ===')
})()
