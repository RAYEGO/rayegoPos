import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import {
  Edit,
  MoreVertical,
  Search,
  Trash2,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AuthorizationGate } from '@/components/auth/AuthorizationGate'
import { useAuth } from '@/hooks/useAuth'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { rtService } from '@/services/rtService'
import {
  usersService,
  type UsersModuleUserRecord,
} from '@/services/usersService'
import type { EspecialidadTecnico, Tecnico } from '@/types/rayegotech'
import { toast } from 'sonner'

const ESPECIALIDADES_OPCIONES: EspecialidadTecnico[] = ['Celular', 'PC', 'Laptop', 'Impresoras', 'Audio']

const tecnicoFormSchema = z.object({
  usuarioId: z.string().uuid('Selecciona un usuario.'),
  especialidades: z.array(z.enum(['Celular', 'PC', 'Laptop', 'Impresoras', 'Audio'])).default([]),
  activo: z.boolean().default(true),
})
type TecnicoFormValues = z.infer<typeof tecnicoFormSchema>

function getEspecialidadesBadges(especialidades: EspecialidadTecnico[]) {
  if (!especialidades?.length) return <Badge variant="outline">Sin especialidades</Badge>
  return (
    <div className="flex flex-wrap gap-1">
      {especialidades.map((esp) => (
        <Badge key={esp} variant="secondary" className="text-[11px]">
          {esp}
        </Badge>
      ))}
    </div>
  )
}

export function TecnicosPage() {
  useEffect(() => {
    document.title = 'Técnicos · RayegoTech'
  }, [])

  const { session } = useAuth()
  const handleUnauthorized = useHandleUnauthorized()
  const accessToken = session?.accessToken ?? ''

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Tecnico[]>([])
  const [usuarios, setUsuarios] = useState<UsersModuleUserRecord[]>([])
  const [search, setSearch] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('ACTIVOS')
  const [includeInactive, setIncludeInactive] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<TecnicoFormValues>({
    usuarioId: '',
    especialidades: [],
    activo: true,
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTecnicos = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const res = await rtService.listTecnicos(includeInactive)
      setItems(res.items || [])
    } catch (err) {
      handleUnauthorized(err)
      if (!(err instanceof ApiError) && !(err instanceof ApiNetworkError)) throw err
    } finally {
      setLoading(false)
    }
  }, [accessToken, includeInactive, handleUnauthorized])

  const fetchUsuarios = useCallback(async () => {
    if (!accessToken) return
    try {
      const list = await usersService.list(accessToken)
      setUsuarios(list || [])
    } catch (err) {
      handleUnauthorized(err)
      if (!(err instanceof ApiError) && !(err instanceof ApiNetworkError)) throw err
    }
  }, [accessToken, handleUnauthorized])

  useEffect(() => {
    fetchTecnicos()
    fetchUsuarios()
  }, [fetchTecnicos, fetchUsuarios])

  const usuarioDeTecnico = useMemo(() => {
    const map: Record<string, UsersModuleUserRecord> = {}
    usuarios.forEach((u) => {
      map[u.id] = u
    })
    return map
  }, [usuarios])

  const tecnicosConUsuario = useMemo(() => {
    return items.map((t) => ({
      ...t,
      _usuario: t.usuario || usuarioDeTecnico[t.usuarioId] || null,
    }))
  }, [items, usuarioDeTecnico])

  const filtrados = useMemo(() => {
    return tecnicosConUsuario.filter((t) => {
      if (filtroActivo === 'ACTIVOS' && !t.activo) return false
      if (filtroActivo === 'INACTIVOS' && t.activo) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const u = t._usuario
        const full = [
          u?.firstName,
          u?.lastName,
          u?.username,
          u?.documentId,
          u?.email,
          u?.phone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!full.includes(q)) return false
      }
      return true
    })
  }, [tecnicosConUsuario, search, filtroActivo])

  const usuariosDisponibles = useMemo(() => {
    const idsOcupados = new Set(tecnicosConUsuario.map((t) => t.usuarioId))
    return usuarios.filter((u) => !idsOcupados.has(u.id) || u.id === formValues.usuarioId)
  }, [usuarios, tecnicosConUsuario, formValues.usuarioId])

  function openCreate() {
    setEditingId(null)
    setFormValues({ usuarioId: '', especialidades: [], activo: true })
    setDrawerOpen(true)
  }
  function openEdit(item: Tecnico) {
    setEditingId(item.id)
    setFormValues({
      usuarioId: item.usuarioId,
      especialidades: Array.isArray(item.especialidades) ? [...item.especialidades] : [],
      activo: item.activo,
    })
    setDrawerOpen(true)
  }

  async function onSave() {
    try {
      tecnicoFormSchema.parse(formValues)
    } catch (err: any) {
      const firstIssue = err?.issues?.[0]
      toast.error(firstIssue?.message || 'Revisa los datos del formulario.')
      return
    }
    try {
      setSaving(true)
      if (editingId) {
        await rtService.updateTecnico(editingId, formValues)
        toast.success('Técnico actualizado.')
      } else {
        await rtService.createTecnico(formValues)
        toast.success('Técnico creado.')
      }
      setDrawerOpen(false)
      await fetchTecnicos()
    } catch (err) {
      handleUnauthorized(err)
      if (err instanceof ApiError || err instanceof ApiNetworkError) {
        toast.error(err.message)
      } else {
        throw err
      }
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    try {
      setDeleting(true)
      await rtService.deleteTecnico(id)
      toast.success('Técnico dado de baja.')
      setDeleteConfirmId(null)
      await fetchTecnicos()
    } catch (err) {
      handleUnauthorized(err)
      if (err instanceof ApiError || err instanceof ApiNetworkError) {
        toast.error(err.message)
      } else {
        throw err
      }
    } finally {
      setDeleting(false)
    }
  }

  function toggleEspecialidad(esp: EspecialidadTecnico) {
    setFormValues((prev) => {
      const has = prev.especialidades.includes(esp)
      return {
        ...prev,
        especialidades: has ? prev.especialidades.filter((e) => e !== esp) : [...prev.especialidades, esp],
      }
    })
  }

  return (
    <div className="space-y-4 p-4">
      <AuthorizationGate
        permission="tecnicos.read"
        fallback={
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No tienes permiso para ver el módulo de Técnicos.
            </CardContent>
          </Card>
        }
      >
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="h-6 w-6 text-primary" />
                Técnicos
              </CardTitle>
              <CardDescription>Gestión de personal técnico asignable a órdenes de servicio.</CardDescription>
            </div>
            <AuthorizationGate
              permission="tecnicos.write"
              fallback={null}
            >
              <Button size="xl" onClick={openCreate}>
                <UserPlus className="h-5 w-5" /> Nuevo técnico
              </Button>
            </AuthorizationGate>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, usuario, DNI, correo, teléfono..."
                  className="pl-9 h-12"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={filtroActivo} onValueChange={(v: any) => setFiltroActivo(v)}>
                  <SelectTrigger className="h-12 w-[180px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVOS">Activos</SelectItem>
                    <SelectItem value="INACTIVOS">Inactivos</SelectItem>
                    <SelectItem value="TODOS">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex h-12 items-center gap-2 rounded-md border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="whitespace-nowrap">Solicitar inactivos</span>
                </label>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="h-10 w-10" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                No se encontraron técnicos.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Especialidades</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((t) => {
                      const u = t._usuario
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="min-w-[220px]">
                            <div className="font-medium">
                              {u ? `${u.firstName} ${u.lastName}` : `Usuario #${t.usuarioId.slice(0, 8)}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {u?.email || 'Sin correo'} · {u?.phone || 'Sin teléfono'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {u && 'username' in u ? u.username : (u && 'email' in u ? (u.email?.split('@')[0] || '—') : '—')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              DNI {u && 'documentId' in u ? u.documentId : (u && 'numeroDocumento' in u ? u.numeroDocumento : '—')}
                            </div>
                          </TableCell>
                          <TableCell>{getEspecialidadesBadges(t.especialidades)}</TableCell>
                          <TableCell>
                            {t.activo ? (
                              <Badge variant="success" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                Activo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <AuthorizationGate permission="tecnicos.write" fallback={null}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-xl" aria-label="Acciones">
                                    <MoreVertical className="h-5 w-5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <AuthorizationGate permission="tecnicos.write" fallback={null}>
                                    <DropdownMenuItem onClick={() => openEdit(t)} className="h-10">
                                      <Edit className="mr-2 h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setDeleteConfirmId(t.id)}
                                      className="h-10 text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Dar de baja
                                    </DropdownMenuItem>
                                  </AuthorizationGate>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </AuthorizationGate>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <SidePanel open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SidePanelContent className="sm:max-w-xl">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold">
                  {editingId ? 'Editar técnico' : 'Nuevo técnico'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {editingId ? 'Actualiza datos del técnico.' : 'Asigna un usuario existente como técnico.'}
                </p>
              </div>
              <SidePanelClose asChild>
                <Button variant="ghost" size="icon-xl" aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </Button>
              </SidePanelClose>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Usuario *</label>
                <Select
                  value={formValues.usuarioId || ''}
                  disabled={Boolean(editingId)}
                  onValueChange={(v) => setFormValues((p) => ({ ...p, usuarioId: v }))}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecciona un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usuariosDisponibles.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Todos los usuarios ya están asignados como técnicos.
                      </div>
                    ) : (
                      usuariosDisponibles.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="h-11">
                          <div className="flex flex-col items-start">
                            <div>
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @{u.username} · {u.primaryRole}
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Especialidades</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ESPECIALIDADES_OPCIONES.map((esp) => {
                    const checked = formValues.especialidades.includes(esp)
                    return (
                      <label
                        key={esp}
                        className={`flex h-12 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
                          checked ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleEspecialidad(esp)}
                          className="h-5 w-5"
                        />
                        <span>{esp}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex h-12 items-center justify-between rounded-md border px-3">
                <div>
                  <div className="text-sm font-medium">Activo</div>
                  <div className="text-xs text-muted-foreground">
                    Desactiva para quitar asignaciones nuevas sin borrar histórico.
                  </div>
                </div>
                <Switch
                  checked={formValues.activo}
                  onCheckedChange={(v) => setFormValues((p) => ({ ...p, activo: v }))}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
              <SidePanelClose asChild>
                <Button variant="outline" size="xl" disabled={saving}>
                  Cancelar
                </Button>
              </SidePanelClose>
              <Button size="xl" onClick={onSave} disabled={saving}>
                {saving ? <Loader className="h-5 w-5" /> : null}
                {editingId ? 'Guardar cambios' : 'Crear técnico'}
              </Button>
            </div>
          </SidePanelContent>
        </SidePanel>

        {/* Dialog confirmación baja */}
        <DialogSimple
          open={deleteConfirmId !== null}
          onOpenChange={(v) => !v && setDeleteConfirmId(null)}
          title="Dar de baja técnico"
          description="El técnico pasará a inactivo. No se eliminará histórico de órdenes asignadas."
          confirmText="Confirmar baja"
          danger
          loading={deleting}
          onConfirm={() => deleteConfirmId && onDelete(deleteConfirmId)}
        />
      </AuthorizationGate>
    </div>
  )
}

function DialogSimple(props: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  const {
    open,
    onOpenChange,
    title,
    description,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger,
    loading,
    onConfirm,
  } = props
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" size="xl" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            size="xl"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader className="h-5 w-5" /> : null}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
