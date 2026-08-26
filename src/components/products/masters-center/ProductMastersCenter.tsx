import { ProductActivePrinciplesManager } from '@/components/products/active-principles-manager/ProductActivePrinciplesManager'
import { ProductCategoriesManager } from '@/components/products/categories-manager/ProductCategoriesManager'
import { ProductLaboratoriesManager } from '@/components/products/laboratories-manager/ProductLaboratoriesManager'
import { ProductMedicationTypesManager } from '@/components/products/medication-types-manager/ProductMedicationTypesManager'
import { ProductPresentationsManager } from '@/components/products/presentations-manager/ProductPresentationsManager'
import { ProductUnitsManager } from '@/components/products/units-manager/ProductUnitsManager'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ProductMastersCenterProps = {
  accessToken: string
  onMastersChanged?: () => void
  canManageMasters: boolean
}

export function ProductMastersCenter({
  accessToken,
  onMastersChanged,
  canManageMasters,
}: ProductMastersCenterProps) {
  return (
    <div className="space-y-4">
      <Card className="rounded-xl border bg-card p-5 shadow-softSm">
        <p className="text-base font-semibold text-foreground">Catálogos Maestros</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Mantén consistencia en la creación, edición e importación de datos usados por el módulo Productos.
        </p>
      </Card>

      <Tabs defaultValue="categorias">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1.5">
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="laboratorios">Laboratorios</TabsTrigger>
          <TabsTrigger value="tiposMedicamento">Tipos comerciales</TabsTrigger>
          <TabsTrigger value="principiosActivos">Principios activos</TabsTrigger>
          <TabsTrigger value="presentaciones">Presentaciones</TabsTrigger>
          <TabsTrigger value="unidadesMedida">Unidades de medida</TabsTrigger>
          <TabsTrigger value="tiposEmpaque">Tipos de empaque</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <ProductCategoriesManager
            accessToken={accessToken}
            onCategoriesChanged={onMastersChanged}
            canManage={canManageMasters}
          />
        </TabsContent>

        <TabsContent value="laboratorios" className="mt-4">
          <ProductLaboratoriesManager accessToken={accessToken} canManage={canManageMasters} />
        </TabsContent>

        <TabsContent value="tiposMedicamento" className="mt-4">
          <ProductMedicationTypesManager accessToken={accessToken} canManage={canManageMasters} />
        </TabsContent>

        <TabsContent value="principiosActivos" className="mt-4">
          <ProductActivePrinciplesManager
            accessToken={accessToken}
            canManage={canManageMasters}
            onChanged={onMastersChanged}
          />
        </TabsContent>

        <TabsContent value="presentaciones" className="mt-4">
          <ProductPresentationsManager accessToken={accessToken} canManage={canManageMasters} />
        </TabsContent>

        <TabsContent value="unidadesMedida" className="mt-4">
          <ProductUnitsManager accessToken={accessToken} canManage={canManageMasters} />
        </TabsContent>

        <TabsContent value="tiposEmpaque" className="mt-4">
          <Card className="rounded-xl border bg-card p-5 shadow-softSm">
            <p className="text-base font-semibold text-foreground">Tipos de empaque</p>
            <p className="mt-1 text-sm text-muted-foreground">
              En la versión 1.0 este catálogo es fijo. Define el modo de empaque disponible al registrar productos.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">SIMPLE</p>
                  <Badge variant="outline">FIJO</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  El producto se controla solo en unidades base (sin blíster / caja).
                </p>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">BLÍSTER</p>
                  <Badge variant="outline">FIJO</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  El producto controla blísteres y conversiones a unidades base, con reglas de caja opcionales.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
