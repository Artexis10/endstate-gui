import React from "react"
import { Toaster as Sonner, toast } from "sonner"
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"

type ToastType = "info" | "success" | "warning" | "error"

export function showToast(message: string, type: ToastType = "info") {
  const duration = type === "warning" || type === "error" ? 5000 : 3000
  
  let toastId: string | number
  
  const toastOptions = {
    duration,
    onClick: () => {
      toast.dismiss(toastId)
    },
  }

  switch (type) {
    case "success":
      toastId = toast.success(message, toastOptions)
      break
    case "error":
      toastId = toast.error(message, toastOptions)
      break
    case "warning":
      toastId = toast.warning(message, toastOptions)
      break
    default:
      toastId = toast.info(message, toastOptions)
      break
  }
  
  return toastId
}

export function useToast() {
  return { showToast }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}

      <Sonner
        position="bottom-right"
        closeButton={false}
        className="endstate-sonner"
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
