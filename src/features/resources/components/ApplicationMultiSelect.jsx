import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Multi-select combobox for selecting applications.
 * Displays app names and stores full app objects.
 */
export function ApplicationMultiSelect({
  applications = [],
  selectedApps = [],
  onSelectionChange,
  placeholder = "Select applications...",
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredApps = useMemo(() => {
    if (!search?.trim()) return applications;
    const term = search.trim().toLowerCase();
    return applications.filter(
      (app) =>
        (app.name ?? "").toLowerCase().includes(term) ||
        (app.appCode ?? "").toLowerCase().includes(term)
    );
  }, [applications, search]);

  const isSelected = (app) => {
    const appId = app._id ?? app.id;
    return selectedApps.some((a) => (a._id ?? a.id) === appId);
  };

  const handleToggle = (app, checked) => {
    const appId = app._id ?? app.id;
    if (checked) {
      onSelectionChange([...selectedApps, app]);
    } else {
      onSelectionChange(selectedApps.filter((a) => (a._id ?? a.id) !== appId));
    }
  };

  const triggerLabel =
    selectedApps.length === 0
      ? placeholder
      : selectedApps.length === 1
        ? selectedApps[0].name ?? selectedApps[0].appCode ?? "1 selected"
        : `${selectedApps.length} applications selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 px-3 py-2",
            !selectedApps.length && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filteredApps.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No applications found
            </p>
          ) : (
            filteredApps.map((app) => {
              const checked = isSelected(app);
              return (
                <label
                  key={app._id ?? app.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => handleToggle(app, !!c)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {app.supportsLevel2 === false && (
                    <span
                      className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      title="L2 not supported — Level 3 will use Unassigned Level 2"
                    >
                      No L2 Support
                    </span>
                  )}
                  <span className="truncate">{app.name ?? app.appCode ?? "—"}</span>
                  {app.appCode && (
                    <span className="text-xs text-muted-foreground">
                      ({app.appCode})
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
