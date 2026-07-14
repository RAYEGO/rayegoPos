import { hash } from 'bcryptjs'
import { PrismaClient, TipoDocumentoIdentidad } from '@prisma/client'

const prisma = new PrismaClient()

const permissionCatalog = [
  ['dashboard.read', 'General', 'Ver dashboard'],
  ['ventas.read', 'Ventas', 'Ver ventas'],
  ['productos.read', 'Productos', 'Ver productos'],
  ['compras.read', 'Compras', 'Ver compras'],
  ['inventario.read', 'Inventario', 'Ver inventario'],
  ['clientes.read', 'Clientes', 'Ver clientes'],
  ['proveedores.read', 'Proveedores', 'Ver proveedores'],
  ['caja.read', 'Caja', 'Ver caja'],
  ['usuarios.read', 'Seguridad', 'Ver usuarios'],
  ['usuarios.manage', 'Seguridad', 'Gestionar usuarios'],
  ['sesiones.read', 'Seguridad', 'Ver sesiones'],
  ['sesiones.revoke', 'Seguridad', 'Revocar sesiones'],
  ['auditoria.read', 'Seguridad', 'Ver auditoría'],
  ['reportes.read', 'Reportes', 'Ver reportes'],
  ['configuracion.read', 'Configuración', 'Ver configuración'],
] as const

const roleCatalog = [
  {
    code: 'ADMIN',
    name: 'Administrador',
    permissions: permissionCatalog.map(([code]) => code),
  },
  {
    code: 'SUPERVISOR',
    name: 'Supervisor',
    permissions: [
      'dashboard.read',
      'ventas.read',
      'productos.read',
      'compras.read',
      'inventario.read',
      'clientes.read',
      'proveedores.read',
      'caja.read',
      'usuarios.read',
      'sesiones.read',
      'auditoria.read',
      'reportes.read',
    ],
  },
  {
    code: 'CAJERO',
    name: 'Cajero',
    permissions: [
      'dashboard.read',
      'ventas.read',
      'productos.read',
      'inventario.read',
      'clientes.read',
      'caja.read',
    ],
  },
] as const

async function main() {
  const passwordHashes = await Promise.all([
    hash('RayegoPOS2026!', 10),
    hash('RayegoSupervisor2026!', 10),
    hash('RayegoCaja2026!', 10),
  ])

  const company = await prisma.empresa.upsert({
    where: {
      numeroDocumento: '20612345678',
    },
    update: {},
    create: {
      razonSocial: 'Rayego Botica SAC',
      nombreComercial: 'Rayego POS',
      tipoDocumento: TipoDocumentoIdentidad.RUC,
      numeroDocumento: '20612345678',
      email: 'contacto@rayego.pe',
      telefono: '014001122',
      direccion: 'Av. Principal 123 - Lima',
    },
  })

  const branch = await prisma.sucursal.upsert({
    where: {
      empresaId_codigo: {
        empresaId: company.id,
        codigo: 'PRINCIPAL',
      },
    },
    update: {},
    create: {
      empresaId: company.id,
      codigo: 'PRINCIPAL',
      nombre: 'Sucursal Principal',
      direccion: 'Av. Principal 123 - Lima',
      telefono: '014001122',
      email: 'principal@rayego.pe',
      esPrincipal: true,
    },
  })

  for (const [code, module, name] of permissionCatalog) {
    await prisma.permiso.upsert({
      where: {
        codigo: code,
      },
      update: {
        modulo: module,
        nombre: name,
        activo: true,
      },
      create: {
        codigo: code,
        modulo: module,
        nombre: name,
        descripcion: `${name} en ${module}.`,
        activo: true,
      },
    })
  }

  for (const role of roleCatalog) {
    const dbRole = await prisma.rol.upsert({
      where: {
        codigo: role.code,
      },
      update: {
        nombre: role.name,
        activo: true,
      },
      create: {
        codigo: role.code,
        nombre: role.name,
        descripcion: `${role.name} del sistema Rayego POS.`,
        activo: true,
      },
    })

    const permissions = await prisma.permiso.findMany({
      where: {
        codigo: {
          in: [...role.permissions],
        },
      },
    })

    for (const permission of permissions) {
      await prisma.rolPermiso.upsert({
        where: {
          rolId_permisoId: {
            rolId: dbRole.id,
            permisoId: permission.id,
          },
        },
        update: {},
        create: {
          rolId: dbRole.id,
          permisoId: permission.id,
        },
      })
    }
  }

  const users = [
    {
      username: 'admin',
      email: 'admin@rayego.pe',
      nombres: 'Administrador',
      apellidos: 'General',
      passwordHash: passwordHashes[0],
      roleCode: 'ADMIN',
    },
    {
      username: 'supervisor',
      email: 'supervisor@rayego.pe',
      nombres: 'Supervisor',
      apellidos: 'de Operaciones',
      passwordHash: passwordHashes[1],
      roleCode: 'SUPERVISOR',
    },
    {
      username: 'caja',
      email: 'caja@rayego.pe',
      nombres: 'Operador',
      apellidos: 'de Caja',
      passwordHash: passwordHashes[2],
      roleCode: 'CAJERO',
    },
  ] as const

  for (const userData of users) {
    const user = await prisma.usuario.upsert({
      where: {
        username: userData.username,
      },
      update: {
        email: userData.email,
        nombres: userData.nombres,
        apellidos: userData.apellidos,
        passwordHash: userData.passwordHash,
        sucursalId: branch.id,
        activo: true,
      },
      create: {
        sucursalId: branch.id,
        username: userData.username,
        email: userData.email,
        passwordHash: userData.passwordHash,
        nombres: userData.nombres,
        apellidos: userData.apellidos,
        activo: true,
      },
    })

    const role = await prisma.rol.findUniqueOrThrow({
      where: {
        codigo: userData.roleCode,
      },
    })

    await prisma.usuarioRol.upsert({
      where: {
        usuarioId_rolId: {
          usuarioId: user.id,
          rolId: role.id,
        },
      },
      update: {
        activo: true,
        fechaFin: null,
      },
      create: {
        usuarioId: user.id,
        rolId: role.id,
        activo: true,
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
