import {
  ArrowRight,
  Boxes,
  CreditCard,
  LineChart,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { paths } from '@/routes/paths'

const benefits = [
  {
    title: 'Operación rápida y consistente',
    description:
      'Diseñado para el flujo real de boticas: menos clics, más control y una experiencia estable para el cajero.',
    icon: ShieldCheck,
  },
  {
    title: 'Inventario trazable',
    description:
      'Lotes, vencimientos y movimientos con control total. Preparado para Kardex auditable por origen.',
    icon: Boxes,
  },
  {
    title: 'Caja y conciliación',
    description:
      'Control del efectivo físico, arqueos y movimientos. Preparado para pagos digitales y conciliación.',
    icon: CreditCard,
  },
  {
    title: 'Listo para crecer',
    description:
      'Arquitectura multi-tenant preparada y módulos desacoplados. Evoluciona a SaaS sin rediseñar.',
    icon: LineChart,
  },
] as const

const modules = [
  { label: 'Ventas', description: 'Catálogo, carrito y emisión', icon: ShoppingCart },
  { label: 'Productos', description: 'Catálogo, precios y maestros', icon: Boxes },
  { label: 'Inventario', description: 'Stock, lotes y vencimientos', icon: Boxes },
  { label: 'Compras', description: 'Órdenes y recepción', icon: Truck },
  { label: 'Clientes', description: 'Gestión comercial y crédito', icon: Users },
  { label: 'Proveedores', description: 'Abastecimiento y datos fiscales', icon: Truck },
  { label: 'Caja', description: 'Movimientos y arqueo', icon: CreditCard },
  { label: 'Configuración', description: 'Empresa, sucursales e implementación', icon: Settings },
] as const

const steps = [
  {
    title: 'Crear empresa',
    description: 'Registra tu empresa y define la base de tu operación.',
  },
  {
    title: 'Configurar',
    description: 'Completa datos legales, sucursales y series de comprobantes.',
  },
  {
    title: 'Carga inicial de inventario',
    description:
      'Migra tu stock existente con trazabilidad y movimientos de inventario inicial.',
  },
  {
    title: 'Comenzar a vender',
    description: 'Inicia operaciones en caja con un flujo rápido y controlado.',
  },
] as const

export function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="grid gap-8 rounded-2xl border bg-card p-8 shadow-softSm md:grid-cols-[1.2fr_0.8fr] md:items-center md:p-10">
        <div className="space-y-6">
          <Badge variant="outline">Rayego POS v1.0</Badge>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Rayego POS
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Sistema POS y administración para Boticas y Farmacias. Misma interfaz moderna, misma
              identidad visual y una arquitectura preparada para SaaS.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gap-2">
              <Link to={paths.register}>
                Crear mi empresa <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={paths.login}>Iniciar sesión</Link>
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Landing, login, registro y aplicación operativa conviven en un solo frontend desplegado
            en Vercel.
          </div>
        </div>

        <div className="grid gap-3">
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground">Diseño</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Interfaz profesional con patrones consistentes (tablas + drawers) y foco operativo.
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground">Arquitectura</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Rutas públicas y privadas separadas, sesiones y contexto de empresa/sucursal.
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground">Escalabilidad</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Preparado para separar Landing y App en subdominios en el futuro sin cambiar la lógica.
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-h2">Beneficios</h2>
          <p className="text-body text-muted-foreground">
            Enfocado en operación real: control de inventario, flujo de caja y experiencia rápida en
            ventas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <Card key={benefit.title} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">{benefit.title}</div>
                    <div className="text-sm text-muted-foreground">{benefit.description}</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-h2">Módulos</h2>
          <p className="text-body text-muted-foreground">
            El POS se organiza por responsabilidades claras: cada módulo hace una cosa y la hace
            bien.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <Card key={module.label} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">{module.label}</div>
                    <div className="text-sm text-muted-foreground">{module.description}</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-h2">Cómo empezar</h2>
          <p className="text-body text-muted-foreground">
            Un flujo corto y controlado para activar el sistema sin romper la operación.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, idx) => (
            <Card key={step.title} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {idx + 1}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <div className="text-sm text-muted-foreground">{step.description}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 shadow-softSm">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <h2 className="text-h2">¿Listo para comenzar?</h2>
            <p className="text-body text-muted-foreground">
              Crea tu empresa y prepara tu botica para operar con control y trazabilidad.
            </p>
          </div>

          <Button asChild size="lg" className="gap-2">
            <Link to={paths.register}>
              Crear mi empresa <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
