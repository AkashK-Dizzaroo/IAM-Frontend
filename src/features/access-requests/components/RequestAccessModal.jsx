import { useForm, useFieldArray } from "react-hook-form";
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

const EMPTY_ROW = { role: "", resourceId: "" };

export function RequestAccessModal({
  isOpen,
  onClose,
  application,
  availableRoles = [],
  availableResources = [],
  onSubmit,
  isSubmitting = false,
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      rows: [{ ...EMPTY_ROW }],
      justification: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "rows",
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submitHandler = (data) => {
    const payload = {
      applicationId: application?._id ?? application?.id,
      reviewNotes: data.justification,
      requestedItems: data.rows.map((row) => ({
        ...(row.resourceId ? { resourceId: row.resourceId } : {}),
        requestedAttributes: { role: row.role },
      })),
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

        <form onSubmit={handleSubmit(submitHandler)} noValidate>
          <div className="py-4 space-y-3">

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

                  {/* Delete row button */}
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

            {/* Add row button */}
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
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Reason / Justification <span className="text-red-500">*</span>
              </label>
              <Textarea
                {...register("justification", {
                  required: "Justification is required",
                  minLength: { value: 10, message: "Please provide at least 10 characters" },
                })}
                placeholder="Explain why you need this access…"
                rows={3}
                className={errors.justification ? "border-red-400 bg-red-50" : ""}
              />
              {errors.justification && (
                <p className="text-xs text-red-500 mt-1">{errors.justification.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
