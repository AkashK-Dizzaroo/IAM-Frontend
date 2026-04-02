import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Searchable single-select for Level 2 resources.
 * Filters to L2s whose assignedApplications overlap with selectedL1Apps
 * where app.supportsLevel2 === true. Excludes Unassigned nodes.
 */
export function L2ContainerSelect({
  l2Resources = [],
  selectedL2,
  onSelect,
  selectedL1Apps = [],
  placeholder = "Select Level 2...",
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredL2s = useMemo(() => {
    const filtered = l2Resources.filter((r) => {
      if (r.isUnassignedNode === true) return false;
      const l2AppIds = (r.assignedApplications ?? []).map((a) =>
        String(a?._id ?? a)
      );
      const l1AppsWithL2 = selectedL1Apps.filter((app) => app.supportsLevel2 === true);
      const l1Ids = l1AppsWithL2.map((a) => String(a._id ?? a.id));
      return l1Ids.some((id) => l2AppIds.includes(id));
    });
    if (!search?.trim()) return filtered;
    const term = search.trim().toLowerCase();
    return filtered.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(term) ||
        (r.resourceExternalId ?? "").toLowerCase().includes(term)
    );
  }, [l2Resources, selectedL1Apps, search]);

  const selectedId = selectedL2?._id ?? selectedL2;
  const selectedLabel = selectedL2
    ? `${selectedL2.name ?? "—"}${selectedL2.resourceExternalId ? ` (${selectedL2.resourceExternalId})` : ""}`
    : null;

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
            !selectedL2 && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search Level 2 resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filteredL2s.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No Level 2 resources found for selected applications
            </p>
          ) : (
            filteredL2s.map((r) => {
              const rid = r._id ?? r.id;
              const isSelected = String(rid) === String(selectedId);
              return (
                <button
                  key={rid}
                  type="button"
                  className={cn(
                    "w-full flex items-center rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => {
                    onSelect(r);
                    setOpen(false);
                  }}
                >
                  {r.name ?? "—"}
                  {r.resourceExternalId && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({r.resourceExternalId})
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
