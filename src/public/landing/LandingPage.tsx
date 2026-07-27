import {
  ArrowRight,
  BarChart3,
  Boxes,
  CreditCard,
  ShoppingCart,
  Settings,
  Truck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { paths } from '@/routes/paths'
import { Reveal } from '@/public/components/Reveal'
import {
  HeroIllustration,
  IllustrationBlister,
  IllustrationBottle,
  IllustrationChart,
  IllustrationCloud,
  IllustrationLightning,
} from '@/public/landing/illustrations'

const benefits = [
  {
    title: 'Inventario por lotes',
    description: 'Stock por lote, trazabilidad y control real de existencias.',
    Illustration: IllustrationBlister,
  },
  {
    title: 'Control de vencimientos',
    description: 'Alertas claras para operar sin sorpresas y evitar mermas.',
    Illustration: IllustrationBottle,
  },
  {
    title: 'Ventas rápidas',
    description: 'Flujo POS optimizado para caja, sin ruido visual.',
    Illustration: IllustrationLightning,
  },
  {
    title: 'Reportes inteligentes',
    description: 'Resumen operativo para decisiones rápidas del día a día.',
    Illustration: IllustrationChart,
  },
  {
    title: 'Sistema en la nube',
    description: 'Acceso seguro, sesiones y contexto por empresa y sucursal.',
    Illustration: IllustrationCloud,
  },
  {
    title: 'Arquitectura SaaS-ready',
    description: 'Rutas públicas/privadas y multi-tenant preparado para crecer.',
    Illustration: IllustrationChart,
  },
] as const

const modules = [
  { label: 'Ventas', description: 'Catálogo, carrito y emisión', icon: ShoppingCart },
  { label: 'Productos', description: 'Catálogo, precios y maestros', icon: Boxes },
  { label: 'Inventario', description: 'Lotes, stock y vencimientos', icon: Boxes },
  { label: 'Compras', description: 'Órdenes y recepción', icon: Truck },
  { label: 'Clientes', description: 'Gestión comercial y crédito', icon: Users },
  { label: 'Proveedores', description: 'Abastecimiento y datos fiscales', icon: Truck },
  { label: 'Caja', description: 'Movimientos y arqueo', icon: CreditCard },
  { label: 'Reportes', description: 'Tableros y métricas', icon: BarChart3 },
  { label: 'Configuración', description: 'Empresa, sucursales e implementación', icon: Settings },
] as const

export function LandingPage() {
  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden rounded-3xl border bg-card shadow-softSm">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[rgba(26,75,110,0.12)] blur-3xl" />
          <div className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-[rgba(82,183,136,0.14)] blur-3xl" />
        </div>

        <div className="relative grid gap-10 p-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:p-12">
          <Reveal>
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  SaaS para Boticas &amp; Farmacias
                </Badge>
                <Badge variant="success" className="rounded-full px-3 py-1">
                  Multi-tenant preparado
                </Badge>
              </div>

              <div className="space-y-4">
                <h1 className="text-display">
                  Rayego POS
                </h1>
                <p className="text-body-lg text-muted-foreground">
                  Un POS moderno y profesional para operar caja, inventario y compras con trazabilidad por lotes y una arquitectura lista para escalar.
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

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="rounded-full bg-muted px-3 py-1">Inventario por lotes</span>
                <span className="rounded-full bg-muted px-3 py-1">Control de vencimientos</span>
                <span className="rounded-full bg-muted px-3 py-1">Caja &amp; arqueo</span>
                <span className="rounded-full bg-muted px-3 py-1">Reportes operativos</span>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={120}>
            <div className="relative">
              <div className="absolute -inset-2 rounded-3xl bg-[linear-gradient(135deg,rgba(26,75,110,0.24),rgba(82,183,136,0.18))] blur-2xl" />
              <div className="relative rounded-3xl border bg-background/60 p-4 shadow-soft">
                <div className="aspect-[16/11] overflow-hidden rounded-2xl bg-background">
                  <HeroIllustration className="h-full w-full" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Card className="border-transparent bg-muted/60 p-3">
                    <div className="text-xs font-medium text-foreground">Operación</div>
                    <div className="text-xs text-muted-foreground">rápida en caja</div>
                  </Card>
                  <Card className="border-transparent bg-muted/60 p-3">
                    <div className="text-xs font-medium text-foreground">Inventario</div>
                    <div className="text-xs text-muted-foreground">por lotes</div>
                  </Card>
                  <Card className="border-transparent bg-muted/60 p-3">
                    <div className="text-xs font-medium text-foreground">Control</div>
                    <div className="text-xs text-muted-foreground">de vencimientos</div>
                  </Card>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="space-y-8">
        <Reveal>
          <div className="space-y-2">
            <h2 className="text-h2">Beneficios</h2>
            <p className="text-body text-muted-foreground">
              Tecnología y experiencia operativa, enfocadas en el trabajo real de una botica.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <Reveal key={benefit.title} delayMs={60 + index * 60}>
              <Card className="group rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-muted p-3 text-foreground">
                    <benefit.Illustration className="text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">{benefit.title}</div>
                    <div className="text-sm text-muted-foreground">{benefit.description}</div>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <Reveal>
          <div className="space-y-2">
            <h2 className="text-h2">Módulos</h2>
            <p className="text-body text-muted-foreground">
              Un sistema completo, organizado por responsabilidades claras y patrones consistentes.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module, index) => {
            const Icon = module.icon
            return (
              <Reveal key={module.label} delayMs={80 + index * 50}>
                <Card className="group rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-muted p-3 text-muted-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-foreground">{module.label}</div>
                      <div className="text-sm text-muted-foreground">{module.description}</div>
                    </div>
                  </div>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="space-y-8">
        <Reveal>
          <div className="space-y-2">
            <h2 className="text-h2">Cómo empezar</h2>
            <p className="text-body text-muted-foreground">
              Un flujo claro para implementar Rayego POS sin fricción operativa.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 lg:grid-cols-4">
          {[
            {
              title: 'Crear empresa',
              description: 'Define la base legal y operativa.',
              Illustration: IllustrationCloud,
            },
            {
              title: 'Configurar sucursal',
              description: 'Estructura la operación y parámetros.',
              Illustration: IllustrationBottle,
            },
            {
              title: 'Carga inicial de inventario',
              description: 'Migra tu stock con trazabilidad.',
              Illustration: IllustrationBlister,
            },
            {
              title: 'Comenzar a vender',
              description: 'Opera caja con rapidez y control.',
              Illustration: IllustrationLightning,
            },
          ].map((step, index) => (
            <Reveal key={step.title} delayMs={80 + index * 70}>
              <Card className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-semibold text-foreground">{step.title}</div>
                    <div className="text-sm text-muted-foreground">{step.description}</div>
                  </div>
                  <div className="rounded-2xl bg-muted p-3 text-primary">
                    <step.Illustration />
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-primary p-10 text-primary-foreground shadow-softSm">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <Reveal className="relative">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl space-y-2">
              <h2 className="text-h2 text-primary-foreground">
                Activa Rayego POS en tu botica
              </h2>
              <p className="text-body text-primary-foreground/80">
                Crea tu empresa y prepara tu inventario con un proceso controlado. Luego, comienza a vender con un flujo POS rápido y profesional.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="gap-2">
                <Link to={paths.register}>
                  Crear mi empresa <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Link to={paths.login}>Iniciar sesión</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
