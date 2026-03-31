import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../app/components/ui/dialog";

type AppErrorDialogProps = {
  message: string | null;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  description?: string;
};

export function AppErrorDialog({
  message,
  onClose,
  title = "Error",
  closeLabel = "Close",
  description,
}: AppErrorDialogProps) {
  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="overflow-hidden border-slate-200 bg-white p-0 shadow-2xl sm:max-w-lg dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-gradient-to-r from-red-50 via-white to-rose-50 px-6 py-5 dark:border-slate-800 dark:from-red-950/30 dark:via-slate-950 dark:to-rose-950/20">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-slate-950 dark:text-slate-50">{title}</DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
                {description ?? "The application received an error while processing the request."}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5">
          <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            <p className="break-words whitespace-pre-wrap">{message}</p>
          </div>

          <DialogFooter className="mt-5">
            <button
              type="button"
              onClick={onClose}
              className="ui-primary-button bg-slate-900 hover:bg-slate-950 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {closeLabel}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
