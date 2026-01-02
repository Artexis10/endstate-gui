import { Toaster, toast } from 'sonner';
import { X } from 'lucide-react';

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
        icons={{
          close: <X className="h-3.5 w-3.5" />,
        }}
        toastOptions={{
          classNames: {
            toast: 'bg-background/95 backdrop-blur-sm text-foreground border border-border shadow-lg',
            title: 'text-foreground font-medium',
            description: 'text-muted-foreground',
            closeButton: 'bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground border-0 transition-colors',
            success: 'bg-background/95 backdrop-blur-sm text-success border-success/30',
            error: 'bg-background/95 backdrop-blur-sm text-danger border-danger/30',
            warning: 'bg-background/95 backdrop-blur-sm text-warning border-warning/30',
            info: 'bg-background/95 backdrop-blur-sm text-primary border-primary/30',
          },
        }}
      />
    </>
  );
}
