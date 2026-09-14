import { Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  HeartPulse,
  Package,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react'
import { AppLogo } from '@/components/brand/AppLogo'
import { paths } from '@/routes/paths'

const benefits = [
  {
    icon: ShoppingCart,
    title: 'Gestión de ventas',
    subtitle: 'Rápida y segura',
  },
  {
    icon: Package,
    title: 'Control de inventario',
    subtitle: 'Siempre al día',
  },
  {
    icon: Users,
    title: 'Clientes y proveedores',
    subtitle: 'Todo en un solo lugar',
  },
  {
    icon: BarChart3,
    title: 'Reportes en tiempo real',
    subtitle: 'Mejores decisiones',
  },
] as const

export function AuthLayout() {
  const location = useLocation()
  const isLoginRoute = location.pathname === paths.login

  if (!isLoginRoute) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] items-center justify-center p-6">
          <div className="w-full max-w-[440px] rounded-lg border bg-card p-8 shadow-softSm">
            <div className="mb-6 flex items-center justify-center">
              <AppLogo variant="auth" />
            </div>
            <Outlet />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] max-h-[100dvh] w-full overflow-x-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-50 bg-primary"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-40"
        style={{
          backgroundColor: '#1A4B6E',
          backgroundImage: 'url(/fondo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-30 bg-gradient-to-br from-primary/88 via-primary/78 to-primary/65"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 mix-blend-soft-light"
        style={{
          backgroundImage:
            'radial-gradient(circle at top left, hsl(var(--secondary) / 0.18), transparent 55%), radial-gradient(circle at bottom right, hsl(var(--primary) / 0.45), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-primary/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[26%] bg-gradient-to-t from-[#10324D] via-primary/85 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--primary) / 0.58) 0%, hsl(var(--primary) / 0.18) 38%, transparent 68%)',
        }}
      />

      <div className="relative z-10 h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-full overflow-y-auto overflow-x-hidden md:overflow-hidden">
        <div className="mx-auto flex min-h-[100dvh] max-h-[100dvh] w-full max-w-[1600px] flex-col items-stretch justify-center gap-3 px-3 py-3 md:min-h-[100dvh] md:flex-row md:items-center md:gap-4 md:px-6 md:py-4 lg:px-8 lg:py-4 xl:px-10 xl:py-6 [@media(max-height:820px)]:py-2.5 [@media(max-height:780px)]:py-2 [@media(max-height:760px)]:py-1.5 [@media(max-height:760px)]:gap-3 [@media(max-height:740px)]:py-1.25 [@media(max-height:740px)]:gap-2.5 [@media(max-height:720px)]:py-1 [@media(max-height:720px)]:gap-2 [@media(max-height:700px)]:py-0.75 [@media(max-height:700px)]:gap-2 [@media(max-height:680px)]:py-0.5 [@media(max-height:680px)]:gap-1.5 [@media(max-height:660px)]:py-0.25 [@media(max-height:660px)]:gap-1.5 [@media(max-height:640px)]:py-0 [@media(max-height:640px)]:gap-1.25 [@media(max-height:600px)]:py-1.5 [@media(max-height:600px)]:gap-2 [@media(max-height:450px)]:py-1 [@media(max-height:450px)]:gap-1.5 [@media(max-height:380px)]:py-0.5 [@media(max-height:380px)]:gap-1 [@media(max-height:380px)]:px-2">
          <div
            aria-hidden="true"
            className="hidden h-full w-full max-w-[52%] shrink-0 flex-col justify-between overflow-hidden text-white md:flex md:min-h-0 md:py-2 md:pl-2 md:pr-5 lg:pl-6 lg:pr-6 xl:pl-10 xl:pr-10"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-5 lg:gap-6 xl:gap-8 [@media(max-height:760px)]:gap-4 [@media(max-height:740px)]:gap-3.5 [@media(max-height:720px)]:gap-3 [@media(max-height:700px)]:gap-2.5 [@media(max-height:680px)]:gap-2.25 [@media(max-height:660px)]:gap-2 [@media(max-height:640px)]:gap-1.75 [@media(max-height:620px)]:gap-1.5 [@media(max-height:600px)]:gap-1.5">
              <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-medium backdrop-blur-sm md:text-[13px]">
                  <HeartPulse className="h-4 w-4 shrink-0 text-secondary" />
                  <span className="truncate">Cuidando tu bienestar</span>
                </div>
              </div>

              <div className="min-h-0 shrink space-y-2 md:space-y-2.5 lg:space-y-3 xl:space-y-4 [@media(max-height:780px)]:space-y-1.5 [@media(max-height:760px)]:space-y-1.5 [@media(max-height:740px)]:space-y-1.25 [@media(max-height:720px)]:space-y-1 [@media(max-height:700px)]:space-y-1 [@media(max-height:680px)]:space-y-0.85 [@media(max-height:660px)]:space-y-0.75 [@media(max-height:640px)]:space-y-0.65 [@media(max-height:620px)]:space-y-0.6 [@media(max-height:600px)]:space-y-0.5">
                <h1 className="font-black tracking-tight text-[34px] leading-[1.05] md:text-[40px] lg:text-[48px] xl:text-[56px] xl:leading-[1.05] [@media(max-height:820px)]:text-[34px] [@media(max-height:760px)]:text-[30px] [@media(max-height:740px)]:text-[28px] [@media(max-height:720px)]:text-[27px] [@media(max-height:700px)]:text-[26px] [@media(max-height:680px)]:text-[24px] [@media(max-height:660px)]:text-[23px] [@media(max-height:640px)]:text-[22px] [@media(max-height:620px)]:text-[21px] [@media(max-height:600px)]:text-[20px]">
                  Rayego{' '}
                  <span className="text-secondary">POS</span>
                </h1>
                <p className="text-lg font-semibold text-white/90 md:text-xl lg:text-2xl [@media(max-height:820px)]:text-base [@media(max-height:760px)]:text-[15px] [@media(max-height:740px)]:text-[14px] [@media(max-height:720px)]:text-[14px] [@media(max-height:700px)]:text-[13px] [@media(max-height:680px)]:text-[13px] [@media(max-height:660px)]:text-[12.5px] [@media(max-height:640px)]:text-[12px] [@media(max-height:620px)]:text-[12px] [@media(max-height:600px)]:text-[11.5px]">
                  Botica &amp; Farmacia
                </p>
                <p className="max-w-xl leading-relaxed text-white/85 md:text-base lg:text-lg [@media(max-height:820px)]:text-sm [@media(max-height:760px)]:text-[13px] [@media(max-height:740px)]:text-[12px] [@media(max-height:720px)]:text-[12px] [@media(max-height:700px)]:text-[11.5px] [@media(max-height:680px)]:hidden">
                  Un sistema pensado para tu botica,
                  <br className="hidden lg:block" />
                  más simple, más rápido, más cerca de ti.
                </p>
              </div>

              <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:gap-3.5 lg:gap-4 [@media(max-height:880px)]:gap-2.5 [@media(max-height:760px)]:gap-2 [@media(max-height:740px)]:gap-2 [@media(max-height:720px)]:gap-1.75 [@media(max-height:700px)]:gap-1.5 [@media(max-height:680px)]:gap-1.35 [@media(max-height:660px)]:gap-1.2 [@media(max-height:640px)]:gap-1 [@media(max-height:620px)]:hidden">
                {benefits.map(({ icon: Icon, title, subtitle }) => (
                  <li key={title} className="flex min-h-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-secondary ring-1 ring-white/5 backdrop-blur md:h-11 md:w-11 lg:h-12 lg:w-12 [@media(max-height:820px)]:h-10 [@media(max-height:820px)]:w-10 [@media(max-height:760px)]:h-9 [@media(max-height:760px)]:w-9 [@media(max-height:740px)]:h-9 [@media(max-height:740px)]:w-9 [@media(max-height:720px)]:h-[34px] [@media(max-height:720px)]:w-[34px] [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8 [@media(max-height:680px)]:h-8 [@media(max-height:680px)]:w-8 [@media(max-height:660px)]:h-[30px] [@media(max-height:660px)]:w-[30px] [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7">
                      <Icon className="h-5 w-5 md:h-[22px] md:w-[22px] lg:h-6 lg:w-6 [@media(max-height:760px)]:h-4.5 [@media(max-height:760px)]:w-4.5 [@media(max-height:740px)]:h-4.5 [@media(max-height:740px)]:w-4.5 [@media(max-height:720px)]:h-4.5 [@media(max-height:720px)]:w-4.5 [@media(max-height:700px)]:h-4 [@media(max-height:700px)]:w-4 [@media(max-height:680px)]:h-4 [@media(max-height:680px)]:w-4 [@media(max-height:660px)]:h-3.5 [@media(max-height:660px)]:w-3.5 [@media(max-height:640px)]:h-3.5 [@media(max-height:640px)]:w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-[15px] font-semibold text-white lg:text-base [@media(max-height:820px)]:text-sm [@media(max-height:760px)]:text-[13px] [@media(max-height:740px)]:text-[13px] [@media(max-height:720px)]:text-[12.5px] [@media(max-height:700px)]:text-[12.5px] [@media(max-height:680px)]:text-[12px] [@media(max-height:660px)]:text-[12px] [@media(max-height:640px)]:text-[11.5px]">
                        {title}
                      </p>
                      <p className="truncate text-[13px] text-white/75 lg:text-sm [@media(max-height:820px)]:text-[12px] [@media(max-height:760px)]:text-[11.5px] [@media(max-height:740px)]:text-[11px] [@media(max-height:720px)]:text-[11px] [@media(max-height:700px)]:text-[10.5px] [@media(max-height:680px)]:text-[10.5px] [@media(max-height:660px)]:text-[10px] [@media(max-height:640px)]:text-[10px]">
                        {subtitle}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 pt-2 md:space-y-4 lg:space-y-5 [@media(max-height:820px)]:space-y-2 [@media(max-height:760px)]:space-y-1.5 [@media(max-height:740px)]:space-y-1.5 [@media(max-height:720px)]:space-y-1.25 [@media(max-height:700px)]:space-y-1.1 [@media(max-height:680px)]:space-y-1 [@media(max-height:660px)]:space-y-0.9 [@media(max-height:640px)]:space-y-0.8 [@media(max-height:620px)]:space-y-0.75 [@media(max-height:600px)]:hidden">
              <div className="flex items-center gap-4">
                <span className="h-1 w-10 shrink-0 rounded-sm border-l-4 border-secondary" />
                <div className="h-1 flex-1 rounded bg-white/10" />
              </div>
              <blockquote className="max-w-xl leading-relaxed text-white/85 italic lg:text-lg [@media(max-height:820px)]:text-sm [@media(max-height:760px)]:text-[12px] [@media(max-height:740px)]:text-[11.5px] [@media(max-height:720px)]:text-[11.5px] [@media(max-height:700px)]:text-[11px] [@media(max-height:680px)]:text-[10.5px] [@media(max-height:660px)]:text-[10.5px] [@media(max-height:640px)]:text-[10px] [@media(max-height:620px)]:text-[10px]">
                &ldquo;Pequeñas acciones,
                <br className="hidden md:block" />
                grandes resultados en la salud de tu comunidad&rdquo;
              </blockquote>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-white/55 md:text-xs [@media(max-height:760px)]:text-[10.5px] [@media(max-height:740px)]:text-[10.5px] [@media(max-height:720px)]:text-[10.5px] [@media(max-height:700px)]:text-[10px] [@media(max-height:680px)]:text-[10px] [@media(max-height:660px)]:text-[9.5px] [@media(max-height:640px)]:text-[9.5px]">
                <Zap className="h-3.5 w-3.5 shrink-0 text-secondary/80 [@media(max-height:760px)]:h-3.5 [@media(max-height:760px)]:w-3.5 [@media(max-height:740px)]:h-3 [@media(max-height:740px)]:w-3 [@media(max-height:720px)]:h-3 [@media(max-height:720px)]:w-3 [@media(max-height:700px)]:h-3 [@media(max-height:700px)]:w-3 [@media(max-height:680px)]:h-3 [@media(max-height:680px)]:w-3 [@media(max-height:660px)]:h-2.5 [@media(max-height:660px)]:w-2.5 [@media(max-height:640px)]:h-2.5 [@media(max-height:640px)]:w-2.5" />
                <span className="truncate">
                  Sistema de gestión para boticas y farmacias · Rayego POS
                </span>
              </div>
            </div>
          </div>

          <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center md:min-h-0 md:max-w-[48%] lg:max-w-[48%] xl:max-w-[48%]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
