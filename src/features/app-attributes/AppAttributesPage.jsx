import React, { useState, useMemo, useEffect } from "react";
import { Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { appAttributeService } from "./api/appAttributeService";
import { appPolicyService } from "@/features/app-policies/api/appPolicyService";
import { useAbacScope } from "@/features/scope";
import { BulkImportDialog } from "./components/BulkImportDialog";

const DATA_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "list", label: "List" },
  { value: "datetime", label: "DateTime" },
];

const NAMESPACES = ["subject", "resource", "action", "environment"];

const NAMESPACE_BADGE = {
  subject: "bg-blue-50 text-blue-700 border-blue-200",
  resource: "bg-purple-50 text-purple-700 border-purple-200",
  action: "bg-teal-50 text-teal-700 border-teal-200",
  environment: "bg-gray-100 text-gray-600 border-gray-200",
};

const NAMESPACE_TAB_LABEL = {
  subject: "Subject",
  resource: "Resource",
  action: "Action",
  environment: "Environment",
};

const EMPTY_FORM = {
  attribute_name: "",
  display_name: "",
  description: "",
  namespace: "subject",
  attribute_type: "string",
  allowed_values: "", // comma-separated string in UI
  default_value: "",
  min_value: "",
  max_value: "",
  is_required: false,
  is_multi_valued: false,
  is_user_requestable: false,
  is_action_tab: false,
  parentId: "",
};

function formFromAttr(attr) {
  const c = attr.constraints ?? {};
  return {
    attribute_name: attr.key ?? "",
    display_name: attr.displayName ?? "",
    description: attr.description ?? "",
    namespace: attr.namespace ?? "subject",
    attribute_type: attr.dataType ?? "string",
    allowed_values: (c.allowedValues ?? []).join(", "),
    default_value: c.defaultValue != null ? String(c.defaultValue) : "",
    min_value: c.min != null ? String(c.min) : "",
    max_value: c.max != null ? String(c.max) : "",
    is_required: attr.isRequired ?? false,
    is_multi_valued: attr.isMultiValued ?? false,
    is_user_requestable: attr.isUserRequestable ?? false,
    is_action_tab: c.action_tab === true,
    parentId: attr.parentId ?? "",
    id: attr.id,
  };
}

function buildPayload(form) {
  const constraints = {};
  if (
    (form.attribute_type === "enum" || form.is_action_tab) &&
    form.allowed_values.trim()
  ) {
    constraints.allowedValues = form.allowed_values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (form.attribute_type === "number") {
    if (form.min_value.trim() !== "") constraints.min = Number(form.min_value);
    if (form.max_value.trim() !== "") constraints.max = Number(form.max_value);
  }
  if (form.default_value.trim() !== "") {
    constraints.defaultValue = form.default_value.trim();
  }
  if (form.namespace === "action" && form.is_action_tab) {
    constraints.action_tab = true;
  }
  return {
    namespace: form.namespace,
    key: form.attribute_name.trim(),
    displayName: form.display_name.trim(),
    description: form.description.trim() || undefined,
    dataType: form.attribute_type,
    isRequired: form.is_required,
    isMultiValued: form.is_multi_valued,
    isUserRequestable: form.is_user_requestable,
    parentId: form.parentId || null,
    constraints,
  };
}

// ─── Form fields ─────────────────────────────────────────────────────────────

/**
 * @param {{ form: object, setForm: Function, mode: 'create'|'edit', allAttributes?: object[], lockNamespace?: string | null }} props
 * When lockNamespace is set (create flow), namespace is taken from the active tab and the selector is hidden.
 */
function AttributeForm({
  form,
  setForm,
  mode,
  allAttributes = [],
  lockNamespace = null,
}) {
  const isEdit = mode === "edit";
  const namespaceReadOnly = Boolean(lockNamespace) && !isEdit;

  return (
    <div className="space-y-4">
      {/* attribute_name */}
      <div className="space-y-1.5">
        <Label htmlFor="f-key">
          Attribute Name {!isEdit && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id="f-key"
          placeholder="e.g. tmf_role"
          className="font-mono text-sm"
          value={form.attribute_name}
          disabled={isEdit}
          onChange={(e) =>
            setForm({
              ...form,
              attribute_name: e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_"),
            })
          }
        />
        {isEdit && (
          <p className="text-xs text-gray-400">
            Cannot be changed after creation.
          </p>
        )}
      </div>

      {/* display_name */}
      <div className="space-y-1.5">
        <Label htmlFor="f-display">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="f-display"
          placeholder="e.g. TMF Role"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
      </div>

      {/* description */}
      <div className="space-y-1.5">
        <Label htmlFor="f-desc">Description</Label>
        <Textarea
          id="f-desc"
          placeholder="e.g. Controls access level within eTMF application"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {/* namespace */}
      <div className="space-y-1.5">
        <Label>
          Namespace {!isEdit && <span className="text-red-500">*</span>}
        </Label>
        {namespaceReadOnly ? (
          <div
            className={`flex h-9 w-full items-center rounded-md border px-3 text-sm ${
              NAMESPACE_BADGE[lockNamespace] ?? NAMESPACE_BADGE.environment
            }`}
          >
            <span className="capitalize font-medium">
              {NAMESPACE_TAB_LABEL[lockNamespace] ?? lockNamespace}
            </span>
            <span className="ml-2 text-xs text-gray-500 font-mono">
              ({lockNamespace})
            </span>
          </div>
        ) : (
          <Select
            value={form.namespace}
            disabled={isEdit}
            onValueChange={(v) => setForm({ ...form, namespace: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAMESPACES.map((ns) => (
                <SelectItem key={ns} value={ns}>
                  {NAMESPACE_TAB_LABEL[ns] ?? ns}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(isEdit || namespaceReadOnly) && (
          <p className="text-xs text-gray-400">
            {isEdit
              ? "Cannot be changed after creation."
              : "Choose the namespace tab on the main page to switch."}
          </p>
        )}
      </div>

      {/* attribute_type */}
      <div className="space-y-1.5">
        <Label>
          Attribute Type <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.attribute_type}
          onValueChange={(v) =>
            setForm({
              ...form,
              attribute_type: v,
              allowed_values: "",
              default_value: "",
              min_value: "",
              max_value: "",
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* action_tab — only for action namespace */}
      {form.namespace === "action" && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="f-action-tab"
            checked={form.is_action_tab}
            onCheckedChange={(c) =>
              setForm({ ...form, is_action_tab: Boolean(c) })
            }
          />
          <Label htmlFor="f-action-tab" className="cursor-pointer">
            Action Tab
          </Label>
        </div>
      )}

      {/* allowed_values — for enum, or for action_tab attributes (any type) */}
      {(form.attribute_type === "enum" ||
        (form.namespace === "action" && form.is_action_tab)) && (
        <div className="space-y-1.5">
          <Label htmlFor="f-allowed">
            Allowed Values
            {!isEdit && form.attribute_type === "enum" && (
              <span className="text-red-500"> *</span>
            )}
          </Label>
          <Input
            id="f-allowed"
            placeholder={
              form.is_action_tab
                ? "e.g. open, view, submit"
                : "e.g. read_only, reviewer, submitter"
            }
            value={form.allowed_values}
            onChange={(e) =>
              setForm({ ...form, allowed_values: e.target.value })
            }
          />
          <p className="text-xs text-gray-400">
            Comma-separated list of allowed values.
          </p>
          {form.allowed_values.trim() && (
            <div className="flex flex-wrap gap-1 pt-1">
              {form.allowed_values
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
                .map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="text-xs font-mono"
                  >
                    {v}
                  </Badge>
                ))}
            </div>
          )}
        </div>
      )}

      {/* min/max — only for number */}
      {form.attribute_type === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-min">Min Value</Label>
            <Input
              id="f-min"
              type="number"
              placeholder="e.g. 0"
              value={form.min_value}
              onChange={(e) => setForm({ ...form, min_value: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-max">Max Value</Label>
            <Input
              id="f-max"
              type="number"
              placeholder="e.g. 100"
              value={form.max_value}
              onChange={(e) => setForm({ ...form, max_value: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* default_value */}
      <div className="space-y-1.5">
        <Label htmlFor="f-default">Default Value</Label>
        {form.attribute_type === "enum" ? (
          <Select
            value={form.default_value}
            onValueChange={(v) =>
              setForm({ ...form, default_value: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No default</SelectItem>
              {form.allowed_values
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
                .map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="f-default"
            placeholder={
              form.attribute_type === "boolean"
                ? "true or false"
                : form.attribute_type === "number"
                  ? "0"
                  : form.attribute_type === "datetime"
                    ? "2024-01-01T00:00:00Z"
                    : "Optional default"
            }
            value={form.default_value}
            onChange={(e) =>
              setForm({ ...form, default_value: e.target.value })
            }
          />
        )}
      </div>

      {/* is_required + is_multi_valued + is_user_requestable */}
      <div className="flex flex-col gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="f-required"
            checked={form.is_required}
            onCheckedChange={(c) =>
              setForm({ ...form, is_required: Boolean(c) })
            }
          />
          <Label htmlFor="f-required" className="cursor-pointer">
            Is Required
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="f-multi"
            checked={form.is_multi_valued}
            disabled={isEdit}
            onCheckedChange={(c) =>
              setForm({ ...form, is_multi_valued: Boolean(c) })
            }
          />
          <Label
            htmlFor="f-multi"
            className={`cursor-pointer ${isEdit ? "text-gray-400" : ""}`}
          >
            Is Multi-Valued
          </Label>
          {isEdit && (
            <span className="text-xs text-gray-400">
              (cannot change after creation)
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Filled by User during Access Request?</Label>
          <div className="flex items-center gap-6 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="is_user_requestable"
                value="true"
                checked={form.is_user_requestable === true}
                onChange={() => setForm({ ...form, is_user_requestable: true })}
                className="accent-indigo-600"
              />
              <span className="text-sm">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="is_user_requestable"
                value="false"
                checked={form.is_user_requestable === false}
                onChange={() =>
                  setForm({ ...form, is_user_requestable: false })
                }
                className="accent-indigo-600"
              />
              <span className="text-sm">No</span>
            </label>
          </div>
          <p className="text-xs text-gray-400">
            When set to Yes, end-users will be prompted to fill this attribute
            when requesting access.
          </p>
        </div>
      </div>

      {/* parentId */}
      <div className="space-y-1.5 pt-2 border-t border-gray-100">
        <Label>Parent Attribute (Optional)</Label>
        <Select
          value={form.parentId || "__none__"}
          onValueChange={(v) =>
            setForm({ ...form, parentId: v === "__none__" ? "" : v })
          }
        >
          <SelectTrigger className="bg-gray-50 border-gray-200">
            <SelectValue placeholder="No parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No parent</SelectItem>
            {buildAttributeTree(
              allAttributes.filter(
                (a) => a.id !== form.id && a.namespace === form.namespace,
              ),
            ).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span
                  style={{ paddingLeft: a.level * 16 }}
                  className="flex items-center gap-1"
                >
                  {a.level > 0 && (
                    <span className="text-gray-400 select-none">{"└"}</span>
                  )}
                  {a.displayName}{" "}
                  <span className="text-gray-400 text-xs">({a.key})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-gray-400">
          Defining a parent creates a logical grouping in the UI.
        </p>
      </div>
    </div>
  );
}

function buildAttributeTree(baseList) {
  const base = [...baseList].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const processed = new Set();
  const result = [];

  const addWithChildren = (parent, level) => {
    if (processed.has(parent.id)) return;
    processed.add(parent.id);
    result.push({ ...parent, level });

    const children = base.filter((a) => a.parentId === parent.id);
    children.forEach((c) => addWithChildren(c, level + 1));
  };

  base.filter((a) => !a.parentId).forEach((r) => addWithChildren(r, 0));
  base
    .filter((a) => !processed.has(a.id))
    .forEach((u) => addWithChildren(u, 0));

  return result;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * AppAttributesPage
 *
 * Admin page for managing per-application attribute definitions, displayed in a
 * namespace-tabbed tree view. Supports single-attribute create/edit/delete as well
 * as bulk multi-select delete via a floating action bar. Bulk delete uses
 * Promise.all over individual service calls. Bulk selection resets when the
 * namespace tab changes.
 */
export function AppAttributesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const selectedApp = selectedAppKey
    ? { key: selectedAppKey, name: selectedAppName ?? selectedAppKey }
    : null;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [namespaceTab, setNamespaceTab] = useState("subject");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [showEditDiscardDialog, setShowEditDiscardDialog] = useState(false);
  const [originalEditForm, setOriginalEditForm] = useState({ ...EMPTY_FORM });

  // ── Bulk-select state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: QK.appAttributes(selectedApp?.key),
    queryFn: () => appAttributeService.list(selectedApp.key),
    enabled: !!selectedApp?.key,
  });

  const rawData = data?.data?.data ?? data?.data ?? [];
  const attributes = Array.isArray(rawData) ? rawData : [];

  // Fetch active policies to detect which attr keys are referenced
  const { data: policiesData } = useQuery({
    queryKey: QK.appPolicies(selectedApp?.key, "active"),
    queryFn: () =>
      appPolicyService.list(selectedApp.key, { status: "active" }),
    enabled: !!selectedApp?.key,
  });

  const referencedKeys = useMemo(() => {
    const raw = policiesData?.data?.data ?? policiesData?.data ?? [];
    const policies = Array.isArray(raw) ? raw : [];
    const set = new Set();
    policies.forEach((p) => {
      const conds = p.conditions?.conditions ?? [];
      conds.forEach((c) => {
        if (c.namespace && (c.key ?? c.attribute)) {
          set.add(`${c.namespace}.${c.key ?? c.attribute}`);
        }
      });
    });
    return set;
  }, [policiesData]);

  const countByNamespace = useMemo(() => {
    const counts = { subject: 0, resource: 0, action: 0, environment: 0 };
    for (const a of attributes) {
      const ns = a.namespace;
      if (ns && Object.prototype.hasOwnProperty.call(counts, ns))
        counts[ns] += 1;
    }
    return counts;
  }, [attributes]);

  const treesByNamespace = useMemo(() => {
    const o = {};
    for (const ns of NAMESPACES) {
      o[ns] = buildAttributeTree(attributes.filter((a) => a.namespace === ns));
    }
    return o;
  }, [attributes]);

  // Keep "New Attribute" form aligned with the active namespace tab
  useEffect(() => {
    if (!showCreate) return;
    setCreateForm((f) => ({ ...f, namespace: namespaceTab }));
  }, [namespaceTab, showCreate]);

  // Reset selection when switching namespace tabs.
  const handleNamespaceTabChange = (ns) => {
    setNamespaceTab(ns);
    setSelectedIds(new Set());
  };

  const createMutation = useMutation({
    mutationFn: (payload) =>
      appAttributeService.create(selectedApp?.key, payload),
    onSuccess: () => {
      toast({ title: "Attribute created" });
      queryClient.invalidateQueries({
        queryKey: QK.appAttributes(selectedApp.key),
      });
      setShowCreate(false);
      setCreateForm({ ...EMPTY_FORM });
    },
    onError: (err) =>
      toast({
        title: "Failed to create",
        description: err?.response?.data?.error ?? err.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      appAttributeService.update(selectedApp?.key, id, payload),
    onSuccess: () => {
      toast({ title: "Attribute updated" });
      queryClient.invalidateQueries({
        queryKey: QK.appAttributes(selectedApp.key),
      });
      setEditTarget(null);
    },
    onError: (err) =>
      toast({
        title: "Failed to update",
        description: err?.response?.data?.error ?? err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appAttributeService.delete(selectedApp?.key, id),
    onSuccess: () => {
      toast({ title: "Attribute deleted" });
      queryClient.invalidateQueries({
        queryKey: QK.appAttributes(selectedApp.key),
      });
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast({
        title: "Delete failed",
        description: err?.response?.data?.error ?? err.message,
        variant: "destructive",
      }),
  });

  // ── Bulk delete handler (passed down into the table component) ─────────────
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) => appAttributeService.delete(selectedApp.key, id)),
      );
      toast({
        title: "Attributes deleted",
        description: `${ids.length} attribute${ids.length === 1 ? "" : "s"} deleted.`,
      });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({
        queryKey: QK.appAttributes(selectedApp.key),
      });
    } catch (err) {
      toast({
        title: "Bulk delete failed",
        description: err?.response?.data?.error ?? err.message,
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (!selectedApp) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">
          No Application Selected
        </p>
        <p className="text-sm text-gray-500">
          Select an application to manage its attributes.
        </p>
      </div>
    );
  }

  const handleCreate = () => {
    if (!createForm.attribute_name.trim() || !createForm.display_name.trim())
      return;
    createMutation.mutate(buildPayload(createForm));
  };

  /**
   * Sequentially create a hierarchy of attributes from BulkImportDialog output.
   *
   * Strategy:
   *   1. Pre-flight: detect collisions against existing keys in the current namespace
   *      (the backend has a unique constraint on [applicationId, namespace, key]).
   *   2. Group nodes by depth (0..N).
   *   3. For each depth level, create all nodes in parallel; build a tmp→real id map
   *      from the responses and use it to resolve `parentId` at the next level.
   *   4. Stop on first failure, show a destructive toast, keep dialog open so the
   *      user can fix and retry. Already-created rows from earlier depths persist.
   *
   * @param {import('./BulkImportDialog').ParsedNode[]} nodes Output from BulkImportDialog.
   */
  const processBulkImport = async (nodes) => {
    if (!selectedApp?.key || !nodes?.length) return;

    // Pre-flight: backend uniqueness on (applicationId, namespace, key).
    const existingKeysInNs = new Set(
      attributes.filter((a) => a.namespace === namespaceTab).map((a) => a.key),
    );
    const collisions = nodes.filter((n) => existingKeysInNs.has(n.key));
    if (collisions.length > 0) {
      toast({
        title: "Cannot import: duplicate keys",
        description: `${collisions.length} key(s) already exist in "${namespaceTab}": ${collisions
          .slice(0, 3)
          .map((n) => n.key)
          .join(", ")}${collisions.length > 3 ? "…" : ""}`,
        variant: "destructive",
      });
      return;
    }

    const byDepth = new Map();
    for (const n of nodes) {
      if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
      byDepth.get(n.depth).push(n);
    }
    const depths = [...byDepth.keys()].sort((a, b) => a - b);
    const totalLevels = depths.length;

    /** Maps tmp UUID (ParsedNode.id) → real backend UUID. */
    const idMap = new Map();

    setIsImporting(true);
    try {
      for (let i = 0; i < depths.length; i++) {
        const depth = depths[i];
        const batch = byDepth.get(depth);
        setImportStatus(
          `Importing attributes (Level ${i + 1}/${totalLevels}) — ${batch.length} item(s)…`,
        );

        const payloads = batch.map((node) => {
          const realParentId = node.parentId
            ? (idMap.get(node.parentId) ?? null)
            : null;
          return {
            node,
            payload: {
              namespace: namespaceTab,
              key: node.key,
              displayName: node.displayName,
              description: node.displayName,
              dataType: "boolean",
              isRequired: null,
              isMultiValued: null,
              isUserRequestable: null,
              parentId: realParentId,
              constraints: { defaultValue: "true", action_tab: true },
            },
          };
        });

        const results = await Promise.all(
          payloads.map(({ node, payload }) =>
            appAttributeService
              .create(selectedApp.key, payload)
              .then((res) => ({
                node,
                res,
              })),
          ),
        );

        for (const { node, res } of results) {
          const created = res?.data?.data ?? res?.data;
          const realId = created?.id;
          if (!realId) {
            throw new Error(
              `Created attribute "${node.key}" but no id was returned.`,
            );
          }
          idMap.set(node.id, realId);
        }
      }

      await queryClient.invalidateQueries({
        queryKey: QK.appAttributes(selectedApp.key),
      });
      toast({
        title: "Import complete",
        description: `Created ${nodes.length} attribute(s) across ${totalLevels} level(s).`,
      });
      setShowBulkImport(false);
    } catch (err) {
      const created = idMap.size;
      toast({
        title: "Import failed",
        description:
          (err?.response?.data?.error ?? err?.message ?? "Unknown error") +
          (created > 0
            ? ` (${created} of ${nodes.length} attribute(s) were created before the failure; refresh to view)`
            : ""),
        variant: "destructive",
      });
      if (created > 0) {
        await queryClient.invalidateQueries({
          queryKey: QK.appAttributes(selectedApp.key),
        });
      }
    } finally {
      setIsImporting(false);
      setImportStatus(null);
    }
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    const c = {};
    if (
      (editForm.attribute_type === "enum" || editForm.is_action_tab) &&
      editForm.allowed_values.trim()
    ) {
      c.allowedValues = editForm.allowed_values
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (editForm.attribute_type === "number") {
      if (editForm.min_value.trim() !== "") c.min = Number(editForm.min_value);
      if (editForm.max_value.trim() !== "") c.max = Number(editForm.max_value);
    }
    if (editForm.default_value.trim()) {
      c.defaultValue = editForm.default_value.trim();
    }
    if (editForm.namespace === "action" && editForm.is_action_tab) {
      c.action_tab = true;
    }
    updateMutation.mutate({
      id: editTarget.id,
      payload: {
        displayName: editForm.display_name.trim(),
        description: editForm.description.trim() || undefined,
        dataType: editForm.attribute_type,
        isRequired: editForm.is_required,
        isUserRequestable: editForm.is_user_requestable,
        parentId: editForm.parentId || null,
        constraints: c,
      },
    });
  };

  const openEdit = (attr) => {
    const initial = formFromAttr(attr);
    setEditTarget(attr);
    setEditForm(initial);
    setOriginalEditForm(initial);
  };

  const isEditFormDirty =
    JSON.stringify(editForm) !== JSON.stringify(originalEditForm);

  const handleCancelEdit = () => {
    if (isEditFormDirty) {
      setShowEditDiscardDialog(true);
    } else {
      setEditTarget(null);
    }
  };

  // Summary list for the confirmation dialog (max 5 shown).
  const bulkDeletePreviewNames = useMemo(() => {
    const ids = Array.from(selectedIds);
    const matched = attributes.filter((a) => ids.includes(a.id));
    return matched.slice(0, 5).map((a) => a.displayName || a.key);
  }, [selectedIds, attributes]);

  const bulkDeleteOverflow = selectedIds.size > 5 ? selectedIds.size - 5 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {selectedApp.name} — App Attributes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define attributes specific to this application. These cannot
            conflict with Hub Attributes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {namespaceTab === "action" && (
            <Button variant="outline" onClick={() => setShowBulkImport(true)}>
              Import Action Tabs Attribute
            </Button>
          )}
          <Button
            onClick={() => {
              setCreateForm({ ...EMPTY_FORM, namespace: namespaceTab });
              setShowCreate(true);
            }}
          >
            + New Attribute
          </Button>
        </div>
      </div>

      <Tabs
        value={namespaceTab}
        onValueChange={handleNamespaceTabChange}
        className="w-full"
      >
        <TabsList
          className="grid w-full h-auto p-1 gap-1 sm:grid-cols-2 lg:grid-cols-4 bg-gray-100/80"
          aria-label="Attribute namespace"
        >
          {NAMESPACES.map((ns) => (
            <TabsTrigger
              key={ns}
              value={ns}
              className="flex items-center justify-center gap-1.5 py-2.5 text-sm data-[state=active]:shadow-sm"
            >
              <span className="font-medium">
                {NAMESPACE_TAB_LABEL[ns] ?? ns}
              </span>
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  namespaceTab === ns
                    ? "bg-primary/15 text-primary"
                    : "bg-gray-200/80 text-gray-600"
                }`}
              >
                {countByNamespace[ns] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {NAMESPACES.map((ns) => (
          <TabsContent
            key={ns}
            value={ns}
            className="mt-0 pt-4 focus-visible:outline-none"
          >
            <NamespaceAttributesTable
              isLoading={isLoading}
              treeAttributes={treesByNamespace[ns] ?? []}
              referencedKeys={referencedKeys}
              namespaceKey={ns}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onBulkDeleteOpen={() => setBulkDeleteOpen(true)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Create Dialog ── */}
      <Dialog
        open={showCreate}
        onOpenChange={(o) => {
          if (!o) setShowCreate(false);
        }}
      >
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              New {NAMESPACE_TAB_LABEL[namespaceTab] ?? namespaceTab} attribute
              — {selectedApp.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <AttributeForm
              form={createForm}
              setForm={setCreateForm}
              mode="create"
              allAttributes={attributes}
              lockNamespace={namespaceTab}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2 shrink-0">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !createForm.attribute_name.trim() ||
                !createForm.display_name.trim()
              }
            >
              {createMutation.isPending ? "Saving…" : "Save Attribute"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o && !showEditDiscardDialog) handleCancelEdit();
        }}
      >
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Edit Attribute —{" "}
              <span className="font-mono text-sm">{editTarget?.key}</span>
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <AttributeForm
                  form={editForm}
                  setForm={setEditForm}
                  mode="edit"
                  allAttributes={attributes}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2 shrink-0">
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={
                    updateMutation.isPending || !editForm.display_name.trim()
                  }
                >
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit discard confirmation dialog ── */}
      <Dialog
        open={showEditDiscardDialog}
        onOpenChange={setShowEditDiscardDialog}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            You have unsaved changes. They will be lost if you close without
            saving.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowEditDiscardDialog(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowEditDiscardDialog(false);
                setEditTarget(null);
              }}
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Import Dialog ── */}
      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={(o) => {
          if (isImporting) return;
          setShowBulkImport(o);
        }}
        onImportComplete={processBulkImport}
        isImporting={isImporting}
        importStatus={importStatus}
      />

      {/* ── Single-item Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Attribute?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Delete{" "}
            <span className="font-mono font-medium">{deleteTarget?.key}</span>?
            This will fail if any users still have values for this attribute.
          </p>
          {deleteTarget &&
            referencedKeys.has(
              `${deleteTarget.namespace}.${deleteTarget.key}`,
            ) && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 mt-1">
                <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                <p className="text-xs text-amber-800">
                  <strong className="font-semibold">
                    Used in an active policy.
                  </strong>{" "}
                  Deleting this attribute will break any policy conditions that
                  reference{" "}
                  <span className="font-mono">
                    {deleteTarget.namespace}.{deleteTarget.key}
                  </span>
                  . Evaluation will silently fail for those conditions.
                </p>
              </div>
            )}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk-delete confirmation dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "item" : "items"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This action cannot be undone.</p>
          {bulkDeletePreviewNames.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bulkDeletePreviewNames.map((name, i) => (
                <li key={i} className="text-sm text-gray-700 truncate">
                  • {name}
                </li>
              ))}
              {bulkDeleteOverflow > 0 && (
                <li className="text-sm text-gray-400">
                  +{bulkDeleteOverflow} more
                </li>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Converts the flat sorted array produced by `buildAttributeTree` (which has `.level` and `.parentId`)
 * into a proper nested tree of `{ ...attr, children: [] }` objects.
 * Root nodes are those with no `parentId`. Each node's `children` array contains its direct children
 * in the same relative order they appeared in the flat list.
 *
 * @param {Array<object>} flatList - Flat sorted array from `buildAttributeTree`, each item has `.id` and `.parentId`.
 * @returns {Array<object>} Nested root nodes, each with a `children` array.
 */
function buildNestedTree(flatList) {
  const nodeMap = new Map();
  flatList.forEach((attr) => {
    nodeMap.set(attr.id, { ...attr, children: [] });
  });
  const roots = [];
  flatList.forEach((attr) => {
    const node = nodeMap.get(attr.id);
    if (attr.parentId && nodeMap.has(attr.parentId)) {
      nodeMap.get(attr.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/**
 * A single row in the attribute tree view.
 * Renders a checkbox as the first element, then a chevron button (or spacer)
 * for expand/collapse, followed by attribute details and hover-revealed action
 * buttons. Recursively renders child nodes when expanded.
 *
 * @param {{ node: object, level: number, expandedIds: Set<string>, onToggle: Function, referencedKeys: Set<string>, onEdit: Function, onDelete: Function, selectedIds: Set<string>, onSelectionChange: Function }} props
 */
function AttributeTreeNode({
  node,
  level,
  expandedIds,
  onToggle,
  referencedKeys,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isChecked = selectedIds.has(node.id);
  const c = node.constraints ?? {};

  const handleCheckbox = () => {
    onSelectionChange((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  return (
    <>
      <div
        className="flex items-center py-2 hover:bg-gray-50 border-b border-gray-100 transition-colors group"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {/* Row checkbox — hidden until hover or any selection is active */}
        <div className="flex items-center w-6 justify-center shrink-0 mr-1">
          <Checkbox
            checked={isChecked}
            onCheckedChange={handleCheckbox}
            aria-label={`Select ${node.displayName}`}
            className={
              selectedIds.size > 0
                ? "opacity-100"
                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
            }
          />
        </div>

        {/* Chevron / spacer */}
        <div className="flex items-center w-6 justify-center shrink-0 mr-2">
          {hasChildren ? (
            <button
              onClick={() => onToggle(node.id)}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>

        {/* Display name + key — grows to fill available space */}
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-gray-900 text-sm truncate">
              {node.displayName}
            </span>
            <span className="font-mono text-[11px] text-gray-400 bg-gray-100 rounded px-1 py-0.5 leading-none shrink-0">
              {node.key}
            </span>
          </div>
          {node.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {node.description}
            </p>
          )}
          {referencedKeys.has(`${node.namespace}.${node.key}`) && (
            <span className="text-[10px] text-green-700 font-medium">
              ● in active policy
            </span>
          )}
        </div>

        {/* Type badge */}
        <div className="w-[80px] shrink-0">
          <Badge variant="outline" className="capitalize text-xs">
            {node.dataType}
          </Badge>
        </div>

        {/* Allowed values / default */}
        <div className="w-[180px] shrink-0 text-xs text-gray-600">
          {c.allowedValues?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {c.allowedValues.slice(0, 3).map((v) => (
                <span
                  key={v}
                  className="bg-gray-100 rounded px-1.5 py-0.5 font-mono"
                >
                  {v}
                </span>
              ))}
              {c.allowedValues.length > 3 && (
                <span className="text-gray-400">
                  +{c.allowedValues.length - 3}
                </span>
              )}
            </div>
          ) : c.defaultValue != null ? (
            <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5">
              {String(c.defaultValue)}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>

        {/* Flags */}
        <div className="w-[160px] shrink-0">
          <div className="flex flex-wrap gap-1">
            {node.isRequired && (
              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                Required
              </Badge>
            )}
            {node.isMultiValued && (
              <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                Multi
              </Badge>
            )}
            {node.isUserRequestable && (
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                Requestable
              </Badge>
            )}
            {!node.isRequired &&
              !node.isMultiValued &&
              !node.isUserRequestable && (
                <span className="text-gray-300 text-xs">—</span>
              )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 w-[72px] shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            title="Edit attribute"
            onClick={() => onEdit(node)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete attribute"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Render children when expanded */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <AttributeTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              referencedKeys={referencedKeys}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * NamespaceAttributesTable
 *
 * Renders the expand/collapse tree for a single namespace tab. Accepts
 * `selectedIds` and `onSelectionChange` from the parent page for bulk-select,
 * and `onBulkDeleteOpen` to trigger the bulk-delete confirmation dialog.
 *
 * The select-all checkbox in the header operates on the full flat `treeAttributes`
 * array (all ids in this namespace, regardless of expand/collapse state).
 *
 * @param {{ isLoading: boolean, treeAttributes: Array, referencedKeys: Set<string>, namespaceKey: string, onEdit: Function, onDelete: Function, selectedIds: Set<string>, onSelectionChange: Function, onBulkDeleteOpen: Function }} props
 */
function NamespaceAttributesTable({
  isLoading,
  treeAttributes,
  referencedKeys,
  namespaceKey,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  onBulkDeleteOpen,
}) {
  const nestedRoots = useMemo(
    () => buildNestedTree(treeAttributes),
    [treeAttributes],
  );

  // Root nodes start expanded by default
  const [expandedIds, setExpandedIds] = useState(() => {
    return new Set(nestedRoots.map((r) => r.id));
  });

  // Re-sync expanded set when the namespace tab changes (new roots arrive)
  const rootIds = nestedRoots.map((r) => r.id).join(",");
  useEffect(() => {
    setExpandedIds(new Set(nestedRoots.map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIds]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select-all operates on the full flat list for this namespace.
  const allIds = treeAttributes.map((a) => a.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      onSelectionChange((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Column header row */}
      <div className="flex items-center py-2 px-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {/* Select-all checkbox */}
        <div className="flex items-center w-6 justify-center shrink-0 mr-1">
          <Checkbox
            checked={
              allSelected ? true : someSelected ? "indeterminate" : false
            }
            onCheckedChange={handleSelectAll}
            aria-label={`Select all ${NAMESPACE_TAB_LABEL[namespaceKey] ?? namespaceKey} attributes`}
          />
        </div>
        {/* Chevron placeholder */}
        <div className="w-6 shrink-0 mr-2" />
        {/* indent + chevron placeholder + name col */}
        <div className="flex-1">Display Name / Key</div>
        <div className="w-[80px] shrink-0">Type</div>
        <div className="w-[180px] shrink-0">Values / Default</div>
        <div className="w-[160px] shrink-0">Flags</div>
        <div className="w-[72px] shrink-0 text-right">Actions</div>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          Loading…
        </div>
      ) : treeAttributes.length === 0 ? (
        <div className="px-4 py-10 text-center text-gray-400">
          <p className="font-medium">
            No {NAMESPACE_TAB_LABEL[namespaceKey] ?? namespaceKey} attributes
            yet.
          </p>
          <p className="text-xs mt-1">
            Use <strong>+ New Attribute</strong> while this tab is selected to
            add attributes in the{" "}
            <span className="font-mono">{namespaceKey}</span> namespace.
          </p>
        </div>
      ) : (
        <div>
          {nestedRoots.map((root) => (
            <AttributeTreeNode
              key={root.id}
              node={root}
              level={0}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
              referencedKeys={referencedKeys}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
            />
          ))}
        </div>
      )}

      {/* Floating bulk-action bar — visible when any rows are selected */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between rounded-b-lg shadow-sm z-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => onSelectionChange(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Deselect all
            </button>
          </div>
          <Button variant="destructive" size="sm" onClick={onBulkDeleteOpen}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "item" : "items"}
          </Button>
        </div>
      )}
    </div>
  );
}
