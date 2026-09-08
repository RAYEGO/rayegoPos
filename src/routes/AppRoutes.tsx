import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { paths } from '@/routes/paths'
import { RouteAccessMiddleware } from '@/routes/RouteAccessMiddleware'
import { authRoutes, privateRoutes } from '@/routes/routeDefinitions'
import { VentaTicketPage } from '@/pages/VentaTicketPage'
import { LandingPage } from '@/public/landing/LandingPage'
import { PublicLayout } from '@/public/layouts/PublicLayout'
import { NotFoundRedirect } from '@/routes/NotFoundRedirect'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.landing} element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
      </Route>

      <Route element={<RouteAccessMiddleware access={{ publicOnly: true }} />}>
        <Route element={<AuthLayout />}>
          {authRoutes.map((route) => {
            const Component = route.component

            return <Route key={route.path} path={route.path} element={<Component />} />
          })}
        </Route>
      </Route>

      <Route element={<RouteAccessMiddleware access={{ requiresAuth: true }} />}>
        <Route path="/print/sales/:id" element={<VentaTicketPage />} />
        <Route path={paths.app} element={<AppLayout />}>
          {privateRoutes.map((route) => {
            const Component = route.component
            const element = (
              <RouteAccessMiddleware access={route.access}>
                <Component />
              </RouteAccessMiddleware>
            )

            if (route.index) {
              return <Route key={route.path} index element={element} />
            }

            return <Route key={route.path} path={route.path} element={element} />
          })}
        </Route>
      </Route>

      <Route path="/ventas" element={<Navigate to={paths.ventas} replace />} />
      <Route path="/productos" element={<Navigate to={paths.productos} replace />} />
      <Route path="/inventario" element={<Navigate to={paths.inventario} replace />} />
      <Route path="/compras" element={<Navigate to={paths.compras} replace />} />
      <Route path="/clientes" element={<Navigate to={paths.clientes} replace />} />
      <Route path="/proveedores" element={<Navigate to={paths.proveedores} replace />} />
      <Route path="/caja" element={<Navigate to={paths.caja} replace />} />
      <Route path="/configuracion" element={<Navigate to={paths.configuracion} replace />} />
      <Route path="/usuarios" element={<Navigate to={paths.usuarios} replace />} />
      <Route path="/reportes" element={<Navigate to={paths.reportes} replace />} />
      <Route path="/ordenes-servicio" element={<Navigate to={paths.ordenesServicio} replace />} />
      <Route path="/tecnicos" element={<Navigate to={paths.tecnicos} replace />} />
      <Route path="/403" element={<Navigate to={paths.forbidden} replace />} />

      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  )
}
