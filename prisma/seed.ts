import { hash } from 'bcryptjs'
import {
  EstadoLote,
  OrigenMovimientoInventario,
  PrismaClient,
  TipoDocumentoIdentidad,
  TipoMovimientoInventario,
} from '@prisma/client'

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

const productCatalog = {
  categories: [
    {
      code: 'ANALG',
      name: 'Analgésicos',
      description: 'Medicamentos para alivio del dolor y fiebre.',
    },
    {
      code: 'ANTIB',
      name: 'Antibióticos',
      description: 'Tratamientos antimicrobianos de uso controlado.',
    },
    {
      code: 'VITSUP',
      name: 'Vitaminas y suplementos',
      description: 'Suplementación nutricional y preventiva.',
    },
    {
      code: 'RESP',
      name: 'Cuidado respiratorio',
      description: 'Línea respiratoria y alivio sintomático.',
    },
  ],
  laboratories: [
    {
      name: 'AC Farma',
      country: 'Perú',
    },
    {
      name: 'Medifarma',
      country: 'Perú',
    },
    {
      name: 'Bayer',
      country: 'Alemania',
    },
    {
      name: 'MK',
      country: 'Colombia',
    },
  ],
  presentations: [
    'Tabletas',
    'Cápsulas',
    'Jarabe',
    'Suspensión',
    'Ampolla',
  ],
  units: [
    {
      code: 'TAB',
      name: 'Tableta',
      symbol: 'tab',
    },
    {
      code: 'CAP',
      name: 'Cápsula',
      symbol: 'cap',
    },
    {
      code: 'FRA',
      name: 'Frasco',
      symbol: 'fra',
    },
    {
      code: 'AMP',
      name: 'Ampolla',
      symbol: 'amp',
    },
  ],
  activePrinciples: [
    'Paracetamol',
    'Amoxicilina',
    'Loratadina',
    'Vitamina C',
  ],
  products: [
    {
      sku: 'MED-0001',
      name: 'Paracetamol 500 mg',
      categoryName: 'Analgésicos',
      laboratoryName: 'AC Farma',
      presentationName: 'Tabletas',
      unitCode: 'TAB',
      activePrincipleName: 'Paracetamol',
      concentration: '500 mg',
      salePrice: 4.5,
      costPrice: 2.8,
      requiresPrescription: false,
      isControlled: false,
      barcode: '7750000000011',
      sanitaryRegistration: 'RS-PARA-500',
    },
    {
      sku: 'MED-0002',
      name: 'Amoxicilina 500 mg',
      categoryName: 'Antibióticos',
      laboratoryName: 'Medifarma',
      presentationName: 'Cápsulas',
      unitCode: 'CAP',
      activePrincipleName: 'Amoxicilina',
      concentration: '500 mg',
      salePrice: 18.9,
      costPrice: 11.2,
      requiresPrescription: true,
      isControlled: false,
      barcode: '7750000000028',
      sanitaryRegistration: 'RS-AMOX-500',
    },
    {
      sku: 'MED-0003',
      name: 'Loratadina Jarabe',
      categoryName: 'Cuidado respiratorio',
      laboratoryName: 'Bayer',
      presentationName: 'Jarabe',
      unitCode: 'FRA',
      activePrincipleName: 'Loratadina',
      concentration: '5 mg / 5 mL',
      salePrice: 16.5,
      costPrice: 10.4,
      requiresPrescription: false,
      isControlled: false,
      barcode: '7750000000035',
      sanitaryRegistration: 'RS-LORA-JBE',
    },
    {
      sku: 'MED-0004',
      name: 'Vitamina C 1 g',
      categoryName: 'Vitaminas y suplementos',
      laboratoryName: 'MK',
      presentationName: 'Tabletas',
      unitCode: 'TAB',
      activePrincipleName: 'Vitamina C',
      concentration: '1 g',
      salePrice: 22.9,
      costPrice: 14.7,
      requiresPrescription: false,
      isControlled: false,
      barcode: '7750000000042',
      sanitaryRegistration: 'RS-VITC-1000',
    },
  ],
} as const

const inventorySeed = [
  {
    sku: 'MED-0001',
    warehouseName: 'Mostrador principal',
    lotCode: 'PARA-500-0726',
    manufacturedAt: '2026-01-10',
    expiryDate: '2026-12-31',
    unitCost: 2.8,
    initialStock: 120,
    reservedStock: 12,
    blockedStock: 0,
  },
  {
    sku: 'MED-0002',
    warehouseName: 'Controlados',
    lotCode: 'AMOX-500-0926',
    manufacturedAt: '2026-02-05',
    expiryDate: '2026-10-20',
    unitCost: 11.2,
    initialStock: 64,
    reservedStock: 8,
    blockedStock: 6,
  },
  {
    sku: 'MED-0003',
    warehouseName: 'Cadena de frío',
    lotCode: 'LORA-JBE-0826',
    manufacturedAt: '2026-03-01',
    expiryDate: '2026-09-15',
    unitCost: 10.4,
    initialStock: 42,
    reservedStock: 4,
    blockedStock: 0,
  },
  {
    sku: 'MED-0004',
    warehouseName: 'Suplementos',
    lotCode: 'VITC-1000-0127',
    manufacturedAt: '2026-04-12',
    expiryDate: '2027-01-30',
    unitCost: 14.7,
    initialStock: 80,
    reservedStock: 0,
    blockedStock: 0,
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

  await prisma.sucursal.upsert({
    where: {
      empresaId_codigo: {
        empresaId: company.id,
        codigo: 'SECUNDARIA',
      },
    },
    update: {
      nombre: 'Sucursal San Miguel',
      direccion: 'Av. La Marina 845 - San Miguel',
      telefono: '014002233',
      email: 'sanmiguel@rayego.pe',
      esPrincipal: false,
      activo: true,
    },
    create: {
      empresaId: company.id,
      codigo: 'SECUNDARIA',
      nombre: 'Sucursal San Miguel',
      direccion: 'Av. La Marina 845 - San Miguel',
      telefono: '014002233',
      email: 'sanmiguel@rayego.pe',
      esPrincipal: false,
      activo: true,
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

  const createdUsers = new Map<string, string>()

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

    createdUsers.set(userData.roleCode, user.id)
  }

  const adminUserId = createdUsers.get('ADMIN') ?? null

  for (const [index, category] of productCatalog.categories.entries()) {
    await prisma.categoria.upsert({
      where: {
        nombre: category.name,
      },
      update: {
        codigo: category.code,
        descripcion: category.description,
        orden: index,
        activo: true,
        updatedById: adminUserId,
      },
      create: {
        codigo: category.code,
        nombre: category.name,
        descripcion: category.description,
        orden: index,
        activo: true,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })
  }

  for (const laboratory of productCatalog.laboratories) {
    await prisma.laboratorio.upsert({
      where: {
        nombre: laboratory.name,
      },
      update: {
        pais: laboratory.country,
        activo: true,
        updatedById: adminUserId,
      },
      create: {
        nombre: laboratory.name,
        pais: laboratory.country,
        activo: true,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })
  }

  for (const presentationName of productCatalog.presentations) {
    await prisma.presentacion.upsert({
      where: {
        nombre: presentationName,
      },
      update: {
        activo: true,
        updatedById: adminUserId,
      },
      create: {
        nombre: presentationName,
        activo: true,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })
  }

  for (const unit of productCatalog.units) {
    await prisma.unidadMedida.upsert({
      where: {
        codigo: unit.code,
      },
      update: {
        nombre: unit.name,
        simbolo: unit.symbol,
        activo: true,
        updatedById: adminUserId,
      },
      create: {
        codigo: unit.code,
        nombre: unit.name,
        simbolo: unit.symbol,
        activo: true,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })
  }

  for (const activePrincipleName of productCatalog.activePrinciples) {
    await prisma.principioActivo.upsert({
      where: {
        nombre: activePrincipleName,
      },
      update: {
        activo: true,
        updatedById: adminUserId,
      },
      create: {
        nombre: activePrincipleName,
        activo: true,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })
  }

  for (const product of productCatalog.products) {
    const [category, laboratory, presentation, unit, activePrinciple] =
      await Promise.all([
        prisma.categoria.findUniqueOrThrow({
          where: {
            nombre: product.categoryName,
          },
        }),
        prisma.laboratorio.findUniqueOrThrow({
          where: {
            nombre: product.laboratoryName,
          },
        }),
        prisma.presentacion.findUniqueOrThrow({
          where: {
            nombre: product.presentationName,
          },
        }),
        prisma.unidadMedida.findUniqueOrThrow({
          where: {
            codigo: product.unitCode,
          },
        }),
        prisma.principioActivo.findUniqueOrThrow({
          where: {
            nombre: product.activePrincipleName,
          },
        }),
      ])

    const salePrice = product.salePrice
    const costPrice = product.costPrice
    const marginReference =
      costPrice > 0 ? (salePrice - costPrice) / costPrice : null

    const dbProduct = await prisma.producto.upsert({
      where: {
        sku: product.sku,
      },
      update: {
        categoriaId: category.id,
        laboratorioId: laboratory.id,
        presentacionId: presentation.id,
        unidadMedidaId: unit.id,
        nombre: product.name,
        concentracion: product.concentration,
        registroSanitario: product.sanitaryRegistration,
        requiereReceta: product.requiresPrescription,
        esControlado: product.isControlled,
        codigoBarras: product.barcode,
        precioVenta: salePrice,
        costoReferencia: costPrice,
        margenReferencia: marginReference,
        updatedById: adminUserId,
      },
      create: {
        categoriaId: category.id,
        laboratorioId: laboratory.id,
        presentacionId: presentation.id,
        unidadMedidaId: unit.id,
        sku: product.sku,
        nombre: product.name,
        concentracion: product.concentration,
        registroSanitario: product.sanitaryRegistration,
        requiereReceta: product.requiresPrescription,
        esControlado: product.isControlled,
        codigoBarras: product.barcode,
        precioVenta: salePrice,
        costoReferencia: costPrice,
        margenReferencia: marginReference,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })

    await prisma.productoPrincipioActivo.deleteMany({
      where: {
        productoId: dbProduct.id,
      },
    })

    await prisma.productoPrincipioActivo.create({
      data: {
        productoId: dbProduct.id,
        principioActivoId: activePrinciple.id,
        concentracion: product.concentration,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })
  }

  const supplier = await prisma.proveedor.upsert({
    where: {
      numeroDocumento: '20654321987',
    },
    update: {
      razonSocial: 'Droguería Distribuidora Peruana SAC',
      nombreComercial: 'DDP',
      activo: true,
      updatedById: adminUserId,
    },
    create: {
      tipoDocumento: TipoDocumentoIdentidad.RUC,
      numeroDocumento: '20654321987',
      razonSocial: 'Droguería Distribuidora Peruana SAC',
      nombreComercial: 'DDP',
      email: 'abastecimiento@ddp.pe',
      contactoTelefono: '014210987',
      direccion: 'Av. Industrial 456 - Lima',
      activo: true,
      createdById: adminUserId,
      updatedById: adminUserId,
    },
  })

  const openingReason = await prisma.motivoMovimientoInventario.upsert({
    where: {
      codigo: 'APERTURA_LOTE',
    },
    update: {
      nombre: 'Apertura de lote',
      tipo: TipoMovimientoInventario.ENTRADA,
      activo: true,
      updatedById: adminUserId,
    },
    create: {
      codigo: 'APERTURA_LOTE',
      nombre: 'Apertura de lote',
      descripcion: 'Ingreso inicial de un lote al inventario.',
      tipo: TipoMovimientoInventario.ENTRADA,
      activo: true,
      createdById: adminUserId,
      updatedById: adminUserId,
    },
  })

  const reserveReason = await prisma.motivoMovimientoInventario.upsert({
    where: {
      codigo: 'RESERVA_INICIAL',
    },
    update: {
      nombre: 'Reserva inicial',
      tipo: TipoMovimientoInventario.RESERVA,
      activo: true,
      updatedById: adminUserId,
    },
    create: {
      codigo: 'RESERVA_INICIAL',
      nombre: 'Reserva inicial',
      descripcion: 'Reserva registrada durante la apertura del lote.',
      tipo: TipoMovimientoInventario.RESERVA,
      activo: true,
      createdById: adminUserId,
      updatedById: adminUserId,
    },
  })

  const blockReason = await prisma.motivoMovimientoInventario.upsert({
    where: {
      codigo: 'BLOQUEO_INICIAL',
    },
    update: {
      nombre: 'Bloqueo inicial',
      tipo: TipoMovimientoInventario.AJUSTE,
      activo: true,
      updatedById: adminUserId,
    },
    create: {
      codigo: 'BLOQUEO_INICIAL',
      nombre: 'Bloqueo inicial',
      descripcion: 'Bloqueo registrado durante la apertura del lote.',
      tipo: TipoMovimientoInventario.AJUSTE,
      activo: true,
      createdById: adminUserId,
      updatedById: adminUserId,
    },
  })

  for (const entry of inventorySeed) {
    const product = await prisma.producto.findUniqueOrThrow({
      where: {
        sku: entry.sku,
      },
      select: {
        id: true,
        sku: true,
      },
    })

    const availableStock =
      entry.initialStock - entry.reservedStock - entry.blockedStock

    await prisma.inventario.upsert({
      where: {
        sucursalId_productoId: {
          sucursalId: branch.id,
          productoId: product.id,
        },
      },
      update: {
        ubicacion: entry.warehouseName,
        updatedById: adminUserId,
      },
      create: {
        sucursalId: branch.id,
        productoId: product.id,
        ubicacion: entry.warehouseName,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })

    const lot = await prisma.lote.upsert({
      where: {
        sucursalId_productoId_numeroLote: {
          sucursalId: branch.id,
          productoId: product.id,
          numeroLote: entry.lotCode,
        },
      },
      update: {
        proveedorId: supplier.id,
        fechaFabricacion: new Date(`${entry.manufacturedAt}T00:00:00`),
        fechaVencimiento: new Date(`${entry.expiryDate}T00:00:00`),
        costoUnitario: entry.unitCost,
        stockInicial: entry.initialStock,
        stockDisponible: availableStock,
        stockReservado: entry.reservedStock,
        stockBloqueado: entry.blockedStock,
        estado:
          availableStock <= 0 && entry.blockedStock > 0
            ? EstadoLote.BLOQUEADO
            : EstadoLote.ACTIVO,
        updatedById: adminUserId,
      },
      create: {
        sucursalId: branch.id,
        productoId: product.id,
        proveedorId: supplier.id,
        numeroLote: entry.lotCode,
        fechaFabricacion: new Date(`${entry.manufacturedAt}T00:00:00`),
        fechaVencimiento: new Date(`${entry.expiryDate}T00:00:00`),
        costoUnitario: entry.unitCost,
        stockInicial: entry.initialStock,
        stockDisponible: availableStock,
        stockReservado: entry.reservedStock,
        stockBloqueado: entry.blockedStock,
        estado:
          availableStock <= 0 && entry.blockedStock > 0
            ? EstadoLote.BLOQUEADO
            : EstadoLote.ACTIVO,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })

    await prisma.movimientoInventario.deleteMany({
      where: {
        loteId: lot.id,
        origen: OrigenMovimientoInventario.APERTURA,
      },
    })

    await prisma.movimientoInventario.create({
      data: {
        sucursalId: branch.id,
        productoId: product.id,
        loteId: lot.id,
        motivoId: openingReason.id,
        tipo: TipoMovimientoInventario.ENTRADA,
        origen: OrigenMovimientoInventario.APERTURA,
        cantidad: entry.initialStock,
        costoUnitario: entry.unitCost,
        stockResultante: entry.initialStock,
        referencia: `Alta inicial lote ${entry.lotCode}`,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    })

    if (entry.reservedStock > 0) {
      await prisma.movimientoInventario.create({
        data: {
          sucursalId: branch.id,
          productoId: product.id,
          loteId: lot.id,
          motivoId: reserveReason.id,
          tipo: TipoMovimientoInventario.RESERVA,
          origen: OrigenMovimientoInventario.APERTURA,
          cantidad: -entry.reservedStock,
          costoUnitario: entry.unitCost,
          stockResultante: entry.initialStock - entry.reservedStock,
          referencia: `Reserva inicial lote ${entry.lotCode}`,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      })
    }

    if (entry.blockedStock > 0) {
      await prisma.movimientoInventario.create({
        data: {
          sucursalId: branch.id,
          productoId: product.id,
          loteId: lot.id,
          motivoId: blockReason.id,
          tipo: TipoMovimientoInventario.AJUSTE,
          origen: OrigenMovimientoInventario.APERTURA,
          cantidad: -entry.blockedStock,
          costoUnitario: entry.unitCost,
          stockResultante: availableStock,
          referencia: `Bloqueo inicial lote ${entry.lotCode}`,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      })
    }
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
