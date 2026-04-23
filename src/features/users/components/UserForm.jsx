import { useState, useEffect, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react';

// ─── password validation ──────────────────────────────────────────────────────

const PASSWORD_COMPLEXITY_MSG =
  'Min 8 characters, uppercase, lowercase, number, and special character';

function validatePasswordComplexity(password) {
  if (!password || password.length < 8) return PASSWORD_COMPLEXITY_MSG;
  if (!/[A-Z]/.test(password)) return PASSWORD_COMPLEXITY_MSG;
  if (!/[a-z]/.test(password)) return PASSWORD_COMPLEXITY_MSG;
  if (!/\d/.test(password)) return PASSWORD_COMPLEXITY_MSG;
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return PASSWORD_COMPLEXITY_MSG;
  return null;
}

// ─── hub attribute helpers ────────────────────────────────────────────────────

export function normalizeDataType(def) {
  return (def?.dataType ?? '').toLowerCase();
}

export function emptyValueFor(def) {
  const dt = normalizeDataType(def);
  if (dt === 'list' && def?.constraints?.allowedValues?.length) return [];
  return '';
}

export function isValueEmpty(def, value) {
  const dt = normalizeDataType(def);
  if (dt === 'boolean') return value !== 'true' && value !== 'false' && value !== true && value !== false;
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value === null || value === undefined;
}

// ─── HubAttrField ─────────────────────────────────────────────────────────────

function HubAttrField({ def, value, onChange, error, onRemove, isOptional }) {
  const dt = normalizeDataType(def);
  const label = def.displayName || def.key;

  const inputEl = (() => {
    if (dt === 'boolean') {
      return (
        <Select value={value !== '' ? String(value) : undefined} onValueChange={onChange}>
          <SelectTrigger className={error ? 'border-red-400 focus:ring-red-300' : ''}>
            <SelectValue placeholder="Select true or false…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (dt === 'enum' && def?.constraints?.allowedValues?.length) {
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className={error ? 'border-red-400 focus:ring-red-300' : ''}>
            <SelectValue placeholder="Select a value…" />
          </SelectTrigger>
          <SelectContent>
            {def.constraints.allowedValues.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (dt === 'list' && def?.constraints?.allowedValues?.length) {
      return (
        <div className={`flex flex-wrap gap-1.5 p-2 rounded-md border ${error ? 'border-red-400' : 'border-gray-200'} bg-white min-h-[38px]`}>
          {def.constraints.allowedValues.map((v) => {
            const selected = Array.isArray(value) && value.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange(
                    selected
                      ? (Array.isArray(value) ? value : []).filter((x) => x !== v)
                      : [...(Array.isArray(value) ? value : []), v]
                  )
                }
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
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
    return (
      <Input
        type={dt === 'number' ? 'number' : dt === 'datetime' ? 'datetime-local' : 'text'}
        placeholder={
          dt === 'list' ? 'Comma-separated values' :
          dt === 'datetime' ? 'Date & time' :
          dt === 'number' && def.constraints?.min != null && def.constraints?.max != null
            ? `${def.constraints.min} – ${def.constraints.max}`
            : `Enter ${label}…`
        }
        value={value}
        min={dt === 'number' ? def.constraints?.min : undefined}
        max={dt === 'number' ? def.constraints?.max : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'border-red-400 focus-visible:ring-red-300' : ''}
      />
    );
  })();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          {label}
          {!isOptional && <span className="text-red-500 ml-0.5">*</span>}
          <span className="ml-1.5 font-normal font-mono text-[10px] text-gray-400">{def.key}</span>
        </Label>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{def.dataType}</Badge>
          {isOptional && (
            <button
              type="button"
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Remove this attribute"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {inputEl}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── UserForm ─────────────────────────────────────────────────────────────────

/**
 * A unified user creation form for the IAM Admin module.
 *
 * Props:
 *   isAdminMode   – when true, shows Status toggle + Hub Attributes section
 *   attrDefs      – array of hub attribute definitions (used when isAdminMode)
 *   initialValues – optional partial overrides for initial field state
 *   submitted     – parent sets true on submit attempt to show all validation errors
 *   onChange      – (fields, attrValues) => void; called on every change
 */
export function UserForm({
  isAdminMode = false,
  attrDefs = [],
  initialValues = {},
  submitted = false,
  onChange,
}) {
  // ── core fields ───────────────────────────────────────────────────────────
  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    password: '',
    confirmPassword: '',
    ...initialValues,
  });

  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── hub attribute state ────────────────────────────────────────────────────
  const requiredDefs = useMemo(
    () => attrDefs.filter((d) => d.isRequired && d.namespace === 'subject'),
    [attrDefs]
  );
  const optionalDefs = useMemo(
    () => attrDefs.filter((d) => !(d.isRequired && d.namespace === 'subject')),
    [attrDefs]
  );

  const [attrValues, setAttrValues] = useState({});
  const [addedOptionalIds, setAddedOptionalIds] = useState([]);
  const [addAttrPickerId, setAddAttrPickerId] = useState('');

  // seed empty slots for required attrs when defs load
  useEffect(() => {
    if (!isAdminMode) return;
    setAttrValues((prev) => {
      const next = { ...prev };
      requiredDefs.forEach((d) => {
        const id = String(d.id || d._id);
        if (!(id in next)) next[id] = emptyValueFor(d);
      });
      return next;
    });
  }, [requiredDefs, isAdminMode]);

  // bubble all values up to parent
  useEffect(() => {
    onChange?.(fields, attrValues);
  }, [fields, attrValues]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── per-field validation ──────────────────────────────────────────────────
  const validateField = useCallback(
    (name, value, currentFields = fields) => {
      switch (name) {
        case 'firstName':
          if (!value?.trim()) return 'First name is required';
          if (value.length > 50) return 'Must be 50 characters or less';
          return '';
        case 'lastName':
          if (!value?.trim()) return 'Last name is required';
          if (value.length > 50) return 'Must be 50 characters or less';
          return '';
        case 'email':
          if (!value?.trim()) return 'Email address is required';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
          return '';
        case 'address':
          return '';
        case 'password':
          return validatePasswordComplexity(value) || '';
        case 'confirmPassword':
          if (!value?.trim()) return 'Please confirm your password';
          if (value !== currentFields.password) return 'Passwords do not match';
          return '';
        default:
          return '';
      }
    },
    [fields]
  );

  const fieldErrors = useMemo(() => ({
    firstName: validateField('firstName', fields.firstName),
    lastName: validateField('lastName', fields.lastName),
    email: validateField('email', fields.email),
    address: '',
    password: validateField('password', fields.password),
    confirmPassword: validateField('confirmPassword', fields.confirmPassword),
  }), [fields, validateField]);

  const allShownAttrIds = useMemo(
    () => [...requiredDefs.map((d) => String(d.id || d._id)), ...addedOptionalIds],
    [requiredDefs, addedOptionalIds]
  );

  const attrErrors = useMemo(() => {
    if (!submitted) return {};
    const errs = {};
    allShownAttrIds.forEach((id) => {
      const def = attrDefs.find((d) => String(d.id || d._id) === id);
      if (def && isValueEmpty(def, attrValues[id])) {
        errs[id] = `${def.displayName || def.key} is required`;
      }
    });
    return errs;
  }, [submitted, attrValues, allShownAttrIds, attrDefs]);

  const showErr = (name) => (submitted || touched[name]) ? fieldErrors[name] : '';

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => setTouched((prev) => ({ ...prev, [e.target.name]: true }));

  const handleAddOptional = (defId) => {
    if (!defId) return;
    const def = attrDefs.find((d) => String(d.id || d._id) === defId);
    if (!def) return;
    setAddedOptionalIds((prev) => [...prev, defId]);
    setAttrValues((prev) => ({ ...prev, [defId]: emptyValueFor(def) }));
    setAddAttrPickerId('');
  };

  const handleRemoveOptional = (defId) => {
    setAddedOptionalIds((prev) => prev.filter((id) => id !== defId));
    setAttrValues((prev) => { const n = { ...prev }; delete n[defId]; return n; });
  };

  const availableOptionalDefs = optionalDefs.filter(
    (d) => !addedOptionalIds.includes(String(d.id || d._id))
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── name row ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>First Name <span className="text-red-500">*</span></Label>
          <Input
            id="firstName" name="firstName"
            value={fields.firstName}
            onChange={handleChange} onBlur={handleBlur}
            placeholder="e.g. Jane"
            className={showErr('firstName') ? 'border-red-400 focus-visible:ring-red-300' : ''}
          />
          {showErr('firstName') && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />{showErr('firstName')}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Last Name <span className="text-red-500">*</span></Label>
          <Input
            id="lastName" name="lastName"
            value={fields.lastName}
            onChange={handleChange} onBlur={handleBlur}
            placeholder="e.g. Smith"
            className={showErr('lastName') ? 'border-red-400 focus-visible:ring-red-300' : ''}
          />
          {showErr('lastName') && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />{showErr('lastName')}
            </p>
          )}
        </div>
      </div>

      {/* ── email ── */}
      <div className="space-y-1.5">
        <Label>Email <span className="text-red-500">*</span></Label>
        <Input
          id="email" name="email" type="email"
          value={fields.email}
          onChange={handleChange} onBlur={handleBlur}
          placeholder="jane@example.com"
          className={showErr('email') ? 'border-red-400 focus-visible:ring-red-300' : ''}
        />
        {showErr('email') && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />{showErr('email')}
          </p>
        )}
      </div>

      {/* ── address ── */}
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Input
          id="address" name="address"
          value={fields.address}
          onChange={handleChange} onBlur={handleBlur}
          placeholder="Street, City, State, ZIP"
        />
      </div>

      {/* ── password section ── */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              id="password" name="password"
              type={showPassword ? 'text' : 'password'}
              value={fields.password}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Min. 8 chars, upper, lower, number, special"
              className={`pr-10 ${showErr('password') ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {showErr('password') && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />{showErr('password')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Confirm Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              id="confirmPassword" name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={fields.confirmPassword}
              onChange={handleChange} onBlur={handleBlur}
              placeholder="Re-enter password"
              className={`pr-10 ${showErr('confirmPassword') ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {showErr('confirmPassword') && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />{showErr('confirmPassword')}
            </p>
          )}
        </div>
      </div>

      {/* ── admin: hub attributes ── */}
      {isAdminMode && (
        <div className="border-t border-gray-100 pt-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Hub Attributes</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Required attributes must be filled. Optionally add more.
            </p>
          </div>

          {requiredDefs.length > 0 && (
            <div className="space-y-4">
              {requiredDefs.map((def) => {
                const id = String(def.id || def._id);
                return (
                  <HubAttrField
                    key={id}
                    def={def}
                    value={attrValues[id] ?? emptyValueFor(def)}
                    onChange={(v) => setAttrValues((p) => ({ ...p, [id]: v }))}
                    error={attrErrors[id]}
                    isOptional={false}
                  />
                );
              })}
            </div>
          )}

          {addedOptionalIds.length > 0 && (
            <div className="space-y-4 pt-1">
              {addedOptionalIds.map((id) => {
                const def = attrDefs.find((d) => String(d.id || d._id) === id);
                if (!def) return null;
                return (
                  <HubAttrField
                    key={id}
                    def={def}
                    value={attrValues[id] ?? emptyValueFor(def)}
                    onChange={(v) => setAttrValues((p) => ({ ...p, [id]: v }))}
                    error={attrErrors[id]}
                    isOptional
                    onRemove={() => handleRemoveOptional(id)}
                  />
                );
              })}
            </div>
          )}

          {availableOptionalDefs.length > 0 && (
            <div className="pt-1">
              <Select value={addAttrPickerId} onValueChange={handleAddOptional}>
                <SelectTrigger className="text-sm text-gray-500 border-dashed">
                  <SelectValue placeholder="+ Add optional attribute…" />
                </SelectTrigger>
                <SelectContent>
                  {availableOptionalDefs.map((def) => (
                    <SelectItem key={def.id || def._id} value={String(def.id || def._id)}>
                      {def.displayName ? `${def.displayName} (${def.key})` : def.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {requiredDefs.length === 0 && addedOptionalIds.length === 0 && (
            <p className="text-xs text-gray-400">
              No Hub attribute definitions found. Define them in Hub Attributes first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── validation helpers exported for parent submit handlers ────────────────────

export function validateUserFormFields(fields) {
  const errors = {};
  if (!fields.firstName?.trim()) errors.firstName = 'First name is required';
  if (!fields.lastName?.trim()) errors.lastName = 'Last name is required';
  if (!fields.email?.trim()) errors.email = 'Email address is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = 'Enter a valid email address';
  const pwErr = validatePasswordComplexity(fields.password);
  if (pwErr) errors.password = pwErr;
  if (!fields.confirmPassword?.trim()) errors.confirmPassword = 'Please confirm your password';
  else if (fields.confirmPassword !== fields.password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function validateAttrValues(attrDefs, attrValues, shownDefIds) {
  const errors = {};
  shownDefIds.forEach((id) => {
    const def = attrDefs.find((d) => String(d.id || d._id) === id);
    if (def && isValueEmpty(def, attrValues[id])) {
      errors[id] = `${def.displayName || def.key} is required`;
    }
  });
  return errors;
}
