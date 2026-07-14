import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { appAttributeService } from "@/features/app-attributes/api/appAttributeService";

const EMPTY_ROW = { role: "", resourceId: "" };

// ── Dynamic attribute input based on dataType ──────────────────────────────

function AttributeInput({ attr, value, onChange, hasError }) {
  const constraints = attr.constraints ?? {};

  if (attr.dataType === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={`attr-${attr.id}`}
          checked={Boolean(value)}
          onCheckedChange={onChange}
        />
        <Label htmlFor={`attr-${attr.id}`} className="text-sm cursor-pointer">
          {value ? "Yes" : "No"}
        </Label>
      </div>
    );
  }

  if (attr.dataType === "enum" && Array.isArray(constraints.allowedValues)) {
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className={`w-full ${hasError ? "border-red-400 bg-red-50" : ""}`}>
          <SelectValue placeholder="Select a value…" />
        </SelectTrigger>
        <SelectContent>
          {constraints.allowedValues.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // string / number / list / datetime → text input
  return (
    <input
      type={attr.dataType === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${attr.displayName}…`}
      className={`w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
        hasError ? "border-red-400 bg-red-50" : "border-input"
      }`}
    />
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

export function RequestAccessModal({
  isOpen,
  onClose,
  application,
  availableRoles = [],
  availableResources = [],
  onSubmit,
  isSubmitting = false,
}) {
  const [activeTab, setActiveTab] = useState("roles");

  // Tab 2: app attribute values keyed by attributeDefId
  const [attrValues, setAttrValues] = useState({});
  const [attrErrors, setAttrErrors] = useState({});

  const {
    register,
    control,
    handleSubmit,
    trigger,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      rows: [{ ...EMPTY_ROW }],
      justification: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  // Fetch only user-requestable attribute definitions for this app.
  // Uses the /requestable endpoint (userAuth only) instead of the admin-gated /attributes route.
  const appKey = application?.key ?? application?.appKey;
  const { data: attrDefsData, isLoading: attrDefsLoading } = useQuery({
    queryKey: ["appAttrDefs", appKey, "requestable"],
    queryFn: () => appAttributeService.listRequestable(appKey),
    enabled: !!appKey && isOpen,
    staleTime: 60_000,
  });

  // /requestable returns { success, data: [...] } — no nested .data.data
  const rawDefs = attrDefsData?.data?.data ?? attrDefsData?.data ?? [];
  const requestableDefs = Array.isArray(rawDefs) ? rawDefs : [];

  // Attributes fetch is still in-flight — we don't yet know if Tab 2 is required
  const attrsFetchPending = !!appKey && attrDefsLoading;
  const hasRequestableAttrs = requestableDefs.length > 0;

  const handleClose = () => {
    reset();
    setAttrValues({});
    setAttrErrors({});
    setActiveTab("roles");
    onClose();
  };

  // Returns true if all required app attributes have a non-empty value.
  // Populates attrErrors for any required attribute the user left blank.
  const validateAttributes = () => {
    const nextErrors = {};
    for (const attr of requestableDefs) {
      if (!attr.isRequired) continue;
      const val = attrValues[attr.id];
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === "string" && val.trim() === "");
      if (isEmpty) {
        nextErrors[attr.id] = `${attr.displayName} is required`;
      }
    }
    setAttrErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Validate Tab 1 fields then advance to Tab 2
  const handleNextToAttributes = async () => {
    const valid = await trigger(["rows", "justification"]);
    if (valid) setActiveTab("attributes");
  };

  const submitHandler = (data) => {
    // GUARD: attribute fetch not yet resolved — never submit in this state
    if (attrsFetchPending) return;

    // GUARD: still on Tab 1 and Tab 2 is required — treat as "Next" instead of submit.
    // This catches any submission path that bypasses the footer button
    // (Enter key, programmatic submit, etc.).
    if (activeTab === "roles" && hasRequestableAttrs) {
      setActiveTab("attributes");
      return;
    }

    // GUARD: required app attributes left blank — block submit and surface errors on Tab 2.
    if (!validateAttributes()) {
      setActiveTab("attributes");
      return;
    }

    // Build requestedAppAttributes from attrValues (keyed by attr key, not defId)
    const requestedAppAttributes = {};
    for (const attr of requestableDefs) {
      const val = attrValues[attr.id];
      if (val !== undefined && val !== "" && val !== null) {
        requestedAppAttributes[attr.key] = val;
      }
    }

    const payload = {
      applicationId: application?._id ?? application?.id,
      reviewNotes: data.justification,
      requestedItems: data.rows.map((row) => ({
        ...(row.resourceId ? { resourceId: row.resourceId } : {}),
        requestedAttributes: { role: row.role },
      })),
      ...(Object.keys(requestedAppAttributes).length > 0
        ? { requestedAppAttributes }
        : {}),
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Request Access</DialogTitle>
          {application?.name && (
            <DialogDescription>
              Requesting access to{" "}
              <span className="font-medium text-gray-700">{application.name}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Prevent Enter on selects/inputs from submitting; textarea and submit button are exempt */}
        <form // NOSONAR: form-level Enter-key guard only prevents accidental submit — every control stays natively keyboard-operable
          onSubmit={handleSubmit(submitHandler)}
          noValidate
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.type !== "submit") {
              e.preventDefault();
            }
          }}
        >
          {/* Tabs is purely a display component here — onValueChange is intentionally omitted
              so Radix cannot switch tabs autonomously. All navigation goes through the footer buttons. */}
          <Tabs value={activeTab} className="mt-1">
            <TabsList className="w-full mb-4">
              {/* pointer-events-none makes the triggers non-interactive; they are progress indicators only */}
              <TabsTrigger value="roles" className="flex-1 pointer-events-none">
                1 — Roles &amp; Resources
              </TabsTrigger>
              <TabsTrigger
                value="attributes"
                className="flex-1 pointer-events-none"
                disabled={!hasRequestableAttrs}
              >
                2 — Application Attributes
                {hasRequestableAttrs && (
                  <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 font-semibold">
                    {requestableDefs.length}
                  </span>
                )}
                {attrsFetchPending && (
                  <Loader2 className="ml-1.5 w-3 h-3 animate-spin text-gray-400" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Roles & Resources ── */}
            {/* CSS-hidden (not unmounted) so RHF fields stay registered while on Tab 2 */}
            <TabsContent value="roles" forceMount hidden={activeTab !== "roles"}>
              <div className="space-y-3 py-2">
                {/* Column headers */}
                <div className="flex flex-row gap-3 items-center px-1">
                  <span className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Role <span className="text-red-500">*</span>
                  </span>
                  <span className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Resource
                  </span>
                  <span className="w-8" />
                </div>

                {/* Dynamic rows */}
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-row gap-3 items-start">
                      {/* Role dropdown */}
                      <div className="flex-1">
                        <select
                          {...register(`rows.${index}.role`, {
                            required: "Role is required",
                          })}
                          className={`w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
                            errors?.rows?.[index]?.role
                              ? "border-red-400 bg-red-50"
                              : "border-input"
                          }`}
                        >
                          <option value="">Select role…</option>
                          {availableRoles.map((r) => (
                            <option key={r.value ?? r._id ?? r.id} value={r.value ?? r._id ?? r.id}>
                              {r.label ?? r.name}
                            </option>
                          ))}
                        </select>
                        {errors?.rows?.[index]?.role && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.rows[index].role.message}
                          </p>
                        )}
                      </div>

                      {/* Resource dropdown */}
                      <div className="flex-1">
                        <select
                          {...register(`rows.${index}.resourceId`)}
                          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                        >
                          <option value="">No specific resource</option>
                          {availableResources.map((r) => (
                            <option key={r._id ?? r.id} value={r._id ?? r.id}>
                              {r.name ?? r.resourceExternalId}
                              {r.level ? ` (L${r.level})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete row */}
                      <div className="w-8 flex-shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          title="Remove row"
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add row */}
                <button
                  type="button"
                  onClick={() => append({ ...EMPTY_ROW })}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-1 px-1 rounded transition-colors hover:bg-indigo-50"
                >
                  <Plus className="w-4 h-4" />
                  Add role &amp; resource
                </button>

                {/* Justification */}
                <div className="pt-2">
                  <label htmlFor="justification" className="text-sm font-medium text-gray-700 block mb-1.5">
                    Reason / Justification <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    id="justification"
                    {...register("justification", {
                      required: "Justification is required",
                      minLength: { value: 10, message: "Please provide at least 10 characters" },
                      maxLength: { value: 2000, message: "Justification must be 2000 characters or less" },
                    })}
                    placeholder="Explain why you need this access…"
                    rows={3}
                    maxLength={2000}
                    className={errors.justification ? "border-red-400 bg-red-50" : ""}
                  />
                  <div className="flex justify-between items-start mt-1">
                    {errors.justification ? (
                      <p className="text-xs text-red-500">{errors.justification.message}</p>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 2: Application Attributes ── */}
            {/* CSS-hidden (not unmounted) so attr values are retained when going Back */}
            <TabsContent value="attributes" forceMount hidden={activeTab !== "attributes"}>
              <div className="py-2 space-y-4 min-h-[180px]">
                {attrDefsLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading attributes…</span>
                  </div>
                ) : requestableDefs.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-sm">No user-requestable attributes defined for this application.</p>
                  </div>
                ) : (
                  requestableDefs.map((attr) => (
                    <div key={attr.id} className="space-y-1.5">
                      <Label htmlFor={`attr-${attr.id}`}>
                        {attr.displayName}
                        {attr.isRequired && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        <span className="ml-2 text-[10px] text-gray-400 font-mono font-normal">
                          ({attr.dataType})
                        </span>
                      </Label>
                      {attr.description && (
                        <p className="text-xs text-gray-400">{attr.description}</p>
                      )}
                      <AttributeInput
                        attr={attr}
                        value={attrValues[attr.id]}
                        hasError={Boolean(attrErrors[attr.id])}
                        onChange={(val) => {
                          setAttrValues((prev) => ({ ...prev, [attr.id]: val }));
                          if (attrErrors[attr.id]) {
                            setAttrErrors((prev) => {
                              const next = { ...prev };
                              delete next[attr.id];
                              return next;
                            });
                          }
                        }}
                      />
                      {attrErrors[attr.id] && (
                        <p className="text-xs text-red-500 mt-1">{attrErrors[attr.id]}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>

            {/* Tab 2 → Back button */}
            {activeTab === "attributes" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("roles")}
                disabled={isSubmitting}
              >
                ← Back
              </Button>
            )}

            {/* Tab 1 + attributes exist → Next; Tab 1 + no attributes → Submit; Tab 2 → Submit */}
            {activeTab === "roles" && (hasRequestableAttrs || attrsFetchPending) ? (
              <Button
                type="button"
                onClick={handleNextToAttributes}
                disabled={isSubmitting || attrsFetchPending}
              >
                {attrsFetchPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Loading…</>
                  : "Next: App Attributes →"
                }
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Submit Request
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
