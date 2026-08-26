import { createContext, useContext } from 'react'

export function createSafeContext<TContextValue>(
  contextName: string,
): readonly [React.Context<TContextValue | undefined>, () => TContextValue] {
  const Context = createContext<TContextValue | undefined>(undefined)

  const useSafeContext = (): TContextValue => {
    const value = useContext(Context)
    if (value === undefined) {
      throw new Error(
        `use${contextName} debe usarse dentro de un proveedor ${contextName} adecuado.`,
      )
    }
    return value
  }

  return [Context, useSafeContext] as const
}
