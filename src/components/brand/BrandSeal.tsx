type BrandSealProps = {
  className?: string
}

export function BrandSeal({ className }: BrandSealProps) {
  return (
    <img
      src="/logo.png"
      alt="Logo de Rayego POS Botica y Farmacia"
      className={className}
    />
  )
}

