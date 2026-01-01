import { Toaster, toast } from 'sonner';

type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Show a toast notification using sonner
 */
export function showToast(message: string, type: ToastType = 'info', duration = 5000) {
  switch (type) {
    case 'success':
      toast.success(message, { duration });
      break;
    case 'error':
      toast.error(message, { duration });
      break;
    case 'warning':
      toast.warning(message, { duration });
      break;
    case 'info':
    default:
      toast.info(message, { duration });
      break;
  }
}

/**
 * Hook for toast notifications (for compatibility with existing code)
 */
export function useToast() {
  return { showToast };
}

/**
 * Toast provider component - renders the Toaster from sonner
 * Uses CSS variables for theme consistency across light/dark modes
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="bottom-right"
        closeButton={true}
        toastOptions={{
          classNames: {
            toast: 'bg-card text-card-foreground border-border',
            title: 'text-foreground',
            description: 'text-muted-foreground',
            closeButton: 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground border-border',
            success: 'bg-success/10 text-success border-success/20',
            error: 'bg-danger/10 text-danger border-danger/20',
            warning: 'bg-warning/10 text-warning border-warning/20',
            info: 'bg-card text-card-foreground border-border',
          },
        }}
      />
    </>
  );
}
