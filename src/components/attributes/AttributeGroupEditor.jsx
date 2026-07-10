import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Pencil, Check, Trash2 } from 'lucide-react';

// ─── attribute input — one renderer per data type, shared across attribute editors ──

export function AttrInput({ def, value, onChange, disabled }) {
  const constraints = def.constraints ?? {};

  if (def.dataType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={`attr-input-${def.id}`}
          checked={value === true || value === 'true'}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <Label htmlFor={`attr-input-${def.id}`} className="text-sm cursor-pointer">
          {value === true || value === 'true' ? 'Yes' : 'No'}
        </Label>
      </div>
    );
  }

  if (def.dataType === 'enum' && Array.isArray(constraints.allowedValues) && constraints.allowedValues.length > 0) {
    return (
      <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a value…" />
        </SelectTrigger>
        <SelectContent>
          {constraints.allowedValues.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (def.dataType === 'list') {
    if (Array.isArray(constraints.allowedValues) && constraints.allowedValues.length > 0) {
      return (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-gray-200 bg-white min-h-[38px]">
          {constraints.allowedValues.map((v) => {
            const selected = Array.isArray(value) && value.includes(v);
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    selected
                      ? (Array.isArray(value) ? value : []).filter((x) => x !== v)
                      : [...(Array.isArray(value) ? value : []), v]
                  )
                }
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors disabled:opacity-50 ${
                  selected
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-gray-500'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      );
    }
    // Freeform list with no constrained values — comma-separated text entry.
    return (
      <Input
        type="text"
        placeholder="a, b, c"
        value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      type={
        def.dataType === 'number'
          ? 'number'
          : def.dataType === 'datetime'
            ? 'datetime-local'
            : 'text'
      }
      value={value ?? ''}
      onChange={(e) =>
        onChange(
          def.dataType === 'number'
            ? (e.target.value === '' ? undefined : Number(e.target.value))
            : e.target.value
        )
      }
      placeholder={`Enter ${def.displayName || def.key}…`}
      disabled={disabled}
    />
  );
}

export function formatAttrDisplayValue(def, value) {
  if (value === undefined || value === null || value === '') return '—';
  if (def.dataType === 'boolean') return (value === true || value === 'true') ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export function normalizeForCompare(def, value) {
  if (value === undefined || value === null) return '';
  if (def.dataType === 'boolean') return (value === true || value === 'true') ? 'true' : 'false';
  if (Array.isArray(value)) return [...value].sort().join('|');
  return String(value);
}

// ─── attribute row — required always shown; optional ones are add/removable ──

export function AttrRow({ def, value, editing, edited, onToggleEdit, onChange, onRemove, canRemove, disabled }) {
  return (
    <div
      className={`flex items-center justify-between border rounded-md px-3 py-2 transition-colors ${
        edited ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{def.key}</Badge>
        {editing ? (
          <div className="flex-1 min-w-0">
            <AttrInput def={def} value={value} onChange={onChange} disabled={disabled} />
          </div>
        ) : (
          <>
            <span className={`text-sm font-mono truncate ${edited ? 'text-amber-700' : 'text-gray-700'}`}>
              {formatAttrDisplayValue(def, value)}
            </span>
            {edited && <span className="text-xs text-amber-600 italic">(edited)</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!editing && (
          <span className="text-[10px] text-gray-400 font-mono mr-1">
            {def.dataType}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${editing ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-blue-500'}`}
          onClick={onToggleEdit}
          disabled={disabled}
        >
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
        {!def.isRequired && canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── attribute group editor — required attrs always shown, optional attrs addable via dropdown ──
//
// `values` is a controlled {[defId]: value} map. Removing an optional attribute reports its
// value as `undefined` via onChange — callers treat an undefined/empty value as "no value set"
// when building their save payload, so no separate deletion bookkeeping is needed here.
//
// Pass `originalValues` (a {[defId]: value} snapshot of what was loaded from the server) to
// enable the amber "(edited)" highlight; omit it (or pass {}) for creation forms where there
// is nothing to diff against yet — any value the user types will still show as "(edited)"
// since it differs from the blank original, which mirrors how newly-added attributes behave.

export function AttributeGroupEditor({
  defs,
  values,
  originalValues = {},
  onChange,
  disabled = false,
  title,
  description,
  emptyLabel = 'No attributes added.',
}) {
  const [editingDefId, setEditingDefId] = useState(null);
  const [pendingAddId, setPendingAddId] = useState('');
  const [pendingAddValue, setPendingAddValue] = useState('');

  const requiredDefs = useMemo(() => defs.filter((d) => d.isRequired), [defs]);
  const optionalDefs = useMemo(() => defs.filter((d) => !d.isRequired), [defs]);
  const visibleOptionalDefs = useMemo(
    () => optionalDefs.filter((d) => values[d.id] !== undefined),
    [optionalDefs, values]
  );
  const availableOptionalDefs = useMemo(
    () => optionalDefs.filter((d) => values[d.id] === undefined),
    [optionalDefs, values]
  );
  const visibleDefs = useMemo(
    () => [...requiredDefs, ...visibleOptionalDefs],
    [requiredDefs, visibleOptionalDefs]
  );
  const pendingAddDef = useMemo(
    () => availableOptionalDefs.find((d) => d.id === pendingAddId) ?? null,
    [availableOptionalDefs, pendingAddId]
  );

  if (defs.length === 0) return null;

  const handleRemove = (defId) => {
    onChange(defId, undefined);
    setEditingDefId((prev) => (prev === defId ? null : prev));
  };

  const handleConfirmAdd = () => {
    if (!pendingAddDef) return;
    onChange(pendingAddDef.id, pendingAddValue);
    setPendingAddId('');
    setPendingAddValue('');
  };

  return (
    <div className="space-y-3">
      {(title || description) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <p className="text-xs font-medium text-gray-600">{title}</p>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <Badge variant="outline" className="text-xs text-gray-500 shrink-0">
            {visibleDefs.length} assigned
          </Badge>
        </div>
      )}

      {visibleDefs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {visibleDefs.map((def) => (
            <AttrRow
              key={def.id}
              def={def}
              value={values[def.id]}
              editing={editingDefId === def.id}
              edited={
                normalizeForCompare(def, values[def.id]) !==
                normalizeForCompare(def, originalValues[def.id])
              }
              onToggleEdit={() => setEditingDefId((prev) => (prev === def.id ? null : def.id))}
              onChange={(val) => onChange(def.id, val)}
              onRemove={() => handleRemove(def.id)}
              canRemove={!def.isRequired}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {availableOptionalDefs.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2.5">
          <Label className="text-xs font-medium text-gray-700">Add Attribute</Label>
          <Select
            value={pendingAddId}
            onValueChange={(val) => {
              const def = availableOptionalDefs.find((d) => d.id === val);
              setPendingAddId(val);
              setPendingAddValue(def?.dataType === 'boolean' ? false : '');
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select attribute…" />
            </SelectTrigger>
            <SelectContent>
              {availableOptionalDefs.map((def) => (
                <SelectItem key={def.id} value={def.id}>
                  {def.displayName ? `${def.displayName} (${def.key})` : def.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingAddDef && (
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <AttrInput def={pendingAddDef} value={pendingAddValue} onChange={setPendingAddValue} disabled={disabled} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleConfirmAdd}
                disabled={disabled}
              >
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
