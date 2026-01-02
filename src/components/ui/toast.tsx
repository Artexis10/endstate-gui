import React from "react"
import { Toaster as Sonner, toast } from "sonner"
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"

type ToastType = "info" | "success" | "warning" | "error"

export function showToast(message: string, type: ToastType = "info") {
  const duration = type === "warning" || type === "error" ? 5000 : 3000
  
  const toastOptions = {
    duration,
    onClick: (id: string | number) => {
      toast.dismiss(id)
    },
  }

  switch (type) {
    case "success":
      return toast.success(message, toastOptions)
    case "error":
      return toast.error(message, toastOptions)
    case "warning":
      return toast.warning(message, toastOptions)
    default:
      return toast.info(message, toastOptions)
  }
}

export function useToast() {
  return { showToast }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}

      <Sonner
        theme="dark"
        position="bottom-right"
        closeButton={false}
        className="toaster group"
        icons={{
          success: <CircleCheckIcon className="size-4 text-success" />,
          info: <InfoIcon className="size-4 text-primary" />,
          warning: <TriangleAlertIcon className="size-4 text-warning" />,
          error: <OctagonXIcon className="size-4 text-danger" />,
          loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
        }}
        toastOptions={{
          classNames: {
            toast:
              "bg-popover text-popover-foreground border border-border shadow-lg rounded-lg px-4 py-3 cursor-pointer",
            title: "text-sm font-medium leading-5",
            description: "text-sm text-muted-foreground leading-5",
          },
        }}
      />
    </>
  )
}
