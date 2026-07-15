import { cn } from "@/lib/utils"

/**
 * Shared empty/error-state pattern (addendum §6): semantic icon anchor,
 * short title, brief explanation of why the view is empty or failing,
 * and an optional primary action.
 *
 * @param {object} props
 * @param {import('react').ElementType} [props.icon] lucide icon component
 * @param {string} props.title
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.action] e.g. a <Button>
 * @param {"default"|"error"} [props.tone] error tints the icon badge red
 * @param {boolean} [props.bordered] wrap in a dashed panel (list placeholders)
 */
export function EmptyState({ icon: Icon, title, description, action, tone = "default", bordered = false, className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        bordered && "rounded-lg border border-dashed border-border bg-muted/30",
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "mb-4 rounded-full p-4",
            tone === "error" ? "bg-destructive-soft" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-8 w-8",
              tone === "error" ? "text-destructive" : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  )
}
