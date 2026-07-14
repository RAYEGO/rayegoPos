import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export function PageHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 space-y-2">
      <Breadcrumbs />
      <h1 className="text-h1">{title}</h1>
    </div>
  )
}

