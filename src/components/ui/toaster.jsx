import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

// Addendum §6 feedback pattern: every toast leads with a semantic icon,
// then a brief title and short description.
const VARIANT_ICONS = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
}

const VARIANT_ICON_CLASSES = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive-foreground",
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = VARIANT_ICONS[variant ?? "default"] ?? Info
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${VARIANT_ICON_CLASSES[variant ?? "default"]}`} aria-hidden="true" />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
