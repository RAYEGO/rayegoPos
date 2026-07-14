type AuthScreenHeaderProps = {
  title: string
  description: string
}

export function AuthScreenHeader({
  title,
  description,
}: AuthScreenHeaderProps) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="text-h2">{title}</h1>
      <p className="text-body text-muted-foreground">{description}</p>
    </div>
  )
}

