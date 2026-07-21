import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type MasterImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MasterImportDialog({ open, onOpenChange }: MasterImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Catálogo Base</DialogTitle>
          <DialogDescription>
            En futuras versiones permitirá importar los catálogos oficiales de Rayego POS.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

