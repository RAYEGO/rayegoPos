import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { paths } from '@/routes/paths'
import { RouteAccessMiddleware } from '@/routes/RouteAccessMiddleware'
import { authRoutes, privateRoutes } from '@/routes/routeDefinitions'
import { VentaTicketPage } from '@/pages/VentaTicketPage'

export function AppRoutes() {
  return (
    <Routes>
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
        <Route element={<AppLayout />}>
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

      <Route path="*" element={<Navigate to={paths.dashboard} replace />} />
    </Routes>
  )
}
