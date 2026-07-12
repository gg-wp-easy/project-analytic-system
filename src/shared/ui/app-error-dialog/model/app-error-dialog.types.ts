export type AppErrorDialogProps = {
  message: string | null;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  description?: string;
};
