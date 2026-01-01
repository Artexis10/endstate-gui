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
 * Contract E: Dark theme aligned, no light backgrounds
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="bottom-right" 
        theme="dark"
        closeButton={false}
      />
    </>
  );
}
