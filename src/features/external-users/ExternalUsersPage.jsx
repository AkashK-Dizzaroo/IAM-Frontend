import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalUserService } from "@/features/external-users/api/externalUserService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Mail,
  Phone,
  ChevronDown,
  UserCircle2,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_TYPES = [
  { value: "SITE_USER", label: "Site" },
  { value: "CRO_USER", label: "CRO" },
  { value: "VENDOR_USER", label: "Vendor" },
  { value: "REGULATORY_USER", label: "Regulatory & Ethics" },
  { value: "SPONSOR_USER", label: "Sponsor Partner" },
  { value: "AUDITOR_USER", label: "Auditor & Inspector" },
];

const ROLES_BY_TYPE = {
  SITE_USER: [
    "Principal Investigator (PI)",
    "Sub-Investigator",
    "Clinical Research Coordinator (CRC)",
    "Site Manager",
    "Regulatory Coordinator",
    "Research Nurse",
    "Pharmacist",
    "Pharmacy Technician",
    "Laboratory Coordinator",
    "Phlebotomist",
    "Pathologist",
    "Radiologist",
    "Data Entry Coordinator",
    "Site Finance Contact",
  ],
  CRO_USER: [
    "CRO Clinical Trial Manager (CTM)",
    "CRO Project Manager (PM)",
    "Lead CRA",
    "CRA (Clinical Research Associate / Monitor)",
    "Site Management Associate (SMA)",
    "Startup Specialist",
    "Regulatory Specialist",
  ],
  VENDOR_USER: [
    "Central Laboratory User",
    "Imaging Vendor User",
    "IRT / RTSM Vendor User",
    "ePRO Vendor User",
    "eCOA Vendor User",
    "Drug Supply Vendor User",
    "Courier Vendor User",
    "Safety Vendor User (Pharmacovigilance)",
    "Translation Vendor User",
  ],
  REGULATORY_USER: [
    "IRB Member",
    "IEC Member",
    "Ethics Committee Administrator",
    "Regulatory Reviewer",
  ],
  SPONSOR_USER: [
    "Sponsor Representative",
    "Medical Monitor",
    "Safety Reviewer",
    "External Consultant",
  ],
  AUDITOR_USER: [
    "QA Auditor",
    "Regulatory Inspector",
    "Sponsor Auditor",
    "External Auditor",
  ],
};

const ALL_ROLES = Object.values(ROLES_BY_TYPE).flat();

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Australia",
  "Austria",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Bulgaria",
  "Cambodia",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kenya",
  "Laos",
  "Latvia",
  "Lebanon",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Malta",
  "Mexico",
  "Monaco",
  "Myanmar",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Venezuela",
  "Vietnam",
  "Other",
].sort();

const COUNTRY_DIAL_CODES = {
  Afghanistan: "+93",
  Albania: "+355",
  Algeria: "+213",
  Argentina: "+54",
  Australia: "+61",
  Austria: "+43",
  Bangladesh: "+880",
  Belgium: "+32",
  Brazil: "+55",
  Bulgaria: "+359",
  Cambodia: "+855",
  Canada: "+1",
  Chile: "+56",
  China: "+86",
  Colombia: "+57",
  Croatia: "+385",
  Cyprus: "+357",
  "Czech Republic": "+420",
  Denmark: "+45",
  Egypt: "+20",
  Estonia: "+372",
  Finland: "+358",
  France: "+33",
  Germany: "+49",
  Greece: "+30",
  "Hong Kong": "+852",
  Hungary: "+36",
  Iceland: "+354",
  India: "+91",
  Indonesia: "+62",
  Ireland: "+353",
  Israel: "+972",
  Italy: "+39",
  Japan: "+81",
  Jordan: "+962",
  Kenya: "+254",
  Laos: "+856",
  Latvia: "+371",
  Lebanon: "+961",
  Liechtenstein: "+423",
  Lithuania: "+370",
  Luxembourg: "+352",
  Malaysia: "+60",
  Malta: "+356",
  Mexico: "+52",
  Monaco: "+377",
  Myanmar: "+95",
  Netherlands: "+31",
  "New Zealand": "+64",
  Nigeria: "+234",
  Norway: "+47",
  Pakistan: "+92",
  Peru: "+51",
  Philippines: "+63",
  Poland: "+48",
  Portugal: "+351",
  Romania: "+40",
  Russia: "+7",
  "Saudi Arabia": "+966",
  Serbia: "+381",
  Singapore: "+65",
  Slovakia: "+421",
  Slovenia: "+386",
  "South Africa": "+27",
  "South Korea": "+82",
  Spain: "+34",
  "Sri Lanka": "+94",
  Sweden: "+46",
  Switzerland: "+41",
  Taiwan: "+886",
  Thailand: "+66",
  Turkey: "+90",
  Ukraine: "+380",
  "United Arab Emirates": "+971",
  "United Kingdom": "+44",
  "United States": "+1",
  Venezuela: "+58",
  Vietnam: "+84",
  Other: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// RFC 5322–inspired: local@domain.tld, no consecutive dots, no leading/trailing dot
function validateEmail(email) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    email.trim(),
  );
}

// Local part (digits after prefix): 5–12 digits, optional spaces/hyphens
function validateLocalPhone(local) {
  return (
    /^[\d\s\-]{5,15}$/.test(local.trim()) &&
    /\d{5,}/.test(local.replace(/[\s\-]/g, ""))
  );
}

// Name: letters, spaces, hyphens, apostrophes, 2–80 chars
function validateName(val) {
  return /^[a-zA-Z\s\-']{2,80}$/.test(val.trim());
}

// Per-field validation — returns an error string or ""
function validateField(key, value, form) {
  switch (key) {
    case "firstName":
    case "lastName": {
      if (!value.trim()) return "This field is required";
      if (!validateName(value))
        return "Only letters, spaces, hyphens and apostrophes (2–80 chars)";
      return "";
    }
    case "userType":
      return value ? "" : "User type is required";
    case "organization":
      if (!value.trim()) return "Organization is required";
      if (value.trim().length < 2) return "Must be at least 2 characters";
      return "";
    case "role":
      return value ? "" : "Role is required";
    case "country":
      return value ? "" : "Country is required";
    case "email": {
      if (!value.trim()) return "Email is required";
      if (!validateEmail(value))
        return "Enter a valid email address (e.g. user@org.com)";
      return "";
    }
    case "phoneNumber": {
      if (!value.trim()) return "Phone number is required";
      if (!validateLocalPhone(value))
        return "Enter a valid local number (5–15 digits)";
      return "";
    }
    default:
      return "";
  }
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function statusBadge(status) {
  if (status === "ACTIVE")
    return (
      <Badge className="bg-green-100 text-green-800 border border-green-200 hover:bg-green-100">
        Active
      </Badge>
    );
  return (
    <Badge className="bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-100">
      Inactive
    </Badge>
  );
}

const USER_TYPE_META = {
  SITE_USER: {
    label: "Site User",
    cls: "bg-blue-100 text-blue-800 border-blue-200",
  },
  CRO_USER: {
    label: "CRO User",
    cls: "bg-purple-100 text-purple-800 border-purple-200",
  },
  VENDOR_USER: {
    label: "Vendor User",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  REGULATORY_USER: {
    label: "Regulatory & Ethics",
    cls: "bg-teal-100 text-teal-800 border-teal-200",
  },
  SPONSOR_USER: {
    label: "Sponsor Partner",
    cls: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  AUDITOR_USER: {
    label: "Auditor & Inspector",
    cls: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

function userTypeBadge(type) {
  const meta = USER_TYPE_META[type] ?? {
    label: type,
    cls: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge className={`${meta.cls} border hover:${meta.cls.split(" ")[0]}`}>
      {meta.label}
    </Badge>
  );
}

// ─── SearchableSelect (identical pattern to FacilitiesPage) ──────────────────

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  useEffect(() => {
    if (!open) setQuery("");
    else setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-red-400 focus:ring-red-400" : "border-input focus:ring-ring"}`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={inputRef}
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">
                No results
              </li>
            )}
            {filtered.map((opt) => (
              <li
                key={opt}
                className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${
                  opt === value
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  userType: "",
  organization: "",
  role: "",
  country: "",
  email: "",
  phonePrefix: "", // auto-set from country dial code
  phoneNumber: "", // user-entered local digits
  status: "ACTIVE",
};

function splitPhone(phone, country) {
  const prefix = COUNTRY_DIAL_CODES[country] ?? "";
  if (!phone) return { phonePrefix: prefix, phoneNumber: "" };
  const stripped = phone.startsWith(prefix)
    ? phone.slice(prefix.length).trimStart()
    : phone;
  return { phonePrefix: prefix, phoneNumber: stripped };
}

// ─── Normalise API response ───────────────────────────────────────────────────

function normalizeList(res) {
  const body = res?.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ExternalUsersPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [panel, setPanel] = useState(null); // null | 'create' | userObject
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Server state ───────────────────────────────────────────────────────────

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["external-users", { search, typeFilter, statusFilter }],
    queryFn: () =>
      externalUserService.list({
        search: search || undefined,
        userType: typeFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
      }),
    staleTime: 30_000,
  });

  const users = useMemo(() => normalizeList(rawData), [rawData]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["external-users"] });

  const createMutation = useMutation({
    mutationFn: (data) => externalUserService.create(data),
    onSuccess: (res) => {
      const created = res?.data?.data;
      toast({
        title: "External user added",
        description: created
          ? `${created.firstName} ${created.lastName} (${created.userCode})`
          : "User created successfully",
      });
      invalidate();
      closePanel();
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err.response?.data?.error ?? err.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => externalUserService.update(id, data),
    onSuccess: () => {
      toast({ title: "User updated" });
      invalidate();
      closePanel();
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err.response?.data?.error ?? err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => externalUserService.remove(id),
    onSuccess: () => {
      toast({ title: "User deleted" });
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err.response?.data?.error ?? err.message,
        variant: "destructive",
      }),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  // ── Panel helpers ──────────────────────────────────────────────────────────

  const closePanel = () => {
    setPanel(null);
    setErrors({});
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setPanel("create");
  };

  const openEdit = (user) => {
    const { phonePrefix, phoneNumber } = splitPhone(user.phone, user.country);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      organization: user.organization,
      role: user.role,
      country: user.country,
      email: user.email,
      phonePrefix,
      phoneNumber,
      status: user.status,
    });
    setErrors({});
    setPanel(user);
  };

  // Generic text field change + clear error on edit
  const setField = (key) => (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, [key]: val }));
    if (errors[key])
      setErrors((p) => ({ ...p, [key]: validateField(key, val, form) }));
  };

  // Generic select field change + clear error
  const setSelectField = (key) => (val) => {
    setForm((p) => ({ ...p, [key]: val }));
    if (errors[key])
      setErrors((p) => ({ ...p, [key]: validateField(key, val, form) }));
  };

  // Blur handler — validate a single field on leave
  const handleBlur = (key) => () => {
    const val = key === "phoneNumber" ? form.phoneNumber : form[key];
    const err = validateField(key, val ?? "", form);
    setErrors((p) => ({ ...p, [key]: err }));
  };

  const handleUserTypeChange = (val) => {
    setForm((p) => ({ ...p, userType: val, role: "" }));
    setErrors((p) => ({ ...p, userType: "", role: "" }));
  };

  // When country changes — update dial code prefix, keep local number
  const handleCountryChange = (val) => {
    const newPrefix = COUNTRY_DIAL_CODES[val] ?? "";
    setForm((p) => ({ ...p, country: val, phonePrefix: newPrefix }));
    setErrors((p) => ({ ...p, country: "" }));
  };

  // ── Validate all + Submit ─────────────────────────────────────────────────

  const handleSubmit = () => {
    const fieldsToValidate = [
      "firstName",
      "lastName",
      "userType",
      "organization",
      "role",
      "country",
      "email",
      "phoneNumber",
    ];
    const newErrors = {};
    fieldsToValidate.forEach((key) => {
      const val = key === "phoneNumber" ? form.phoneNumber : (form[key] ?? "");
      newErrors[key] = validateField(key, val, form);
    });
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) return; // stop — inline errors shown

    const phone = form.phonePrefix
      ? `${form.phonePrefix} ${form.phoneNumber.trim()}`
      : form.phoneNumber.trim();

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      userType: form.userType,
      organization: form.organization.trim(),
      role: form.role,
      country: form.country,
      email: form.email.trim(),
      phone,
      status: form.status,
    };

    if (panel === "create") {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: panel.id, data: payload });
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(deleteTarget.id);
  };

  // Available roles depend on selected user type
  const roleOptions = form.userType ? ROLES_BY_TYPE[form.userType] : ALL_ROLES;

  return (
    <div className="p-6">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            External Users
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage site and CRO personnel with access to Hub resources
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add External User
        </Button>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search by name, email, or org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter || "__all__"}
          onValueChange={(v) => setTypeFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {USER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || "__all__"}
          onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {(search || typeFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-gray-500"
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setStatusFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Loading skeleton ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            No external users found
          </h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            {search || typeFilter || statusFilter
              ? "Try adjusting your filters"
              : "Add your first external user to get started"}
          </p>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {!isLoading && users.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[88px]" /> {/* User ID */}
                <col className="w-[160px]" /> {/* Name */}
                <col className="w-[100px]" /> {/* User Type */}
                <col className="w-[140px]" /> {/* Organization */}
                <col className="w-[130px]" /> {/* Role */}
                <col className="w-[100px]" /> {/* Country */}
                <col className="w-[200px]" /> {/* Email */}
                <col className="w-[140px]" /> {/* Phone */}
                <col className="w-[80px]" /> {/* Status */}
                <col className="w-[76px]" /> {/* Actions */}
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    User ID
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    User Type
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Organization
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Country
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="group hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                        {u.userCode}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-blue-700">
                            {u.firstName[0]}
                            {u.lastName[0]}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900 truncate">
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{userTypeBadge(u.userType)}</td>
                    <td className="px-3 py-2.5 text-gray-700 truncate">
                      {u.organization}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 truncate">
                      {u.role}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{u.country}</td>
                    <td className="px-3 py-2.5">
                      <a
                        href={`mailto:${u.email}`}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline truncate"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate text-xs">{u.email}</span>
                      </a>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 text-gray-600 text-xs">
                        <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{u.phone}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{statusBadge(u.status)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Remove External User
              </h3>
              <p className="text-sm text-gray-600 mb-5">
                Are you sure you want to remove{" "}
                <span className="font-medium">
                  {deleteTarget.firstName} {deleteTarget.lastName}
                </span>{" "}
                ({deleteTarget.userCode})? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Removing…" : "Remove"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Create / Edit Slide Panel ──────────────────────────────────────── */}
      {panel !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={closePanel}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-[520px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <UserCircle2 className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold text-gray-900 text-base">
                  {panel === "create"
                    ? "Add External User"
                    : `Edit — ${panel.firstName} ${panel.lastName}`}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
              {/* Section: Identity */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Identity
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      User Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.userType}
                      onValueChange={handleUserTypeChange}
                    >
                      <SelectTrigger
                        className={
                          errors.userType
                            ? "border-red-400 focus:ring-red-400"
                            : ""
                        }
                      >
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.userType && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.userType}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>
                        First Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="First name"
                        value={form.firstName}
                        onChange={setField("firstName")}
                        onBlur={handleBlur("firstName")}
                        className={
                          errors.firstName
                            ? "border-red-400 focus:ring-red-400"
                            : ""
                        }
                      />
                      {errors.firstName && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.firstName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Last Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="Last name"
                        value={form.lastName}
                        onChange={setField("lastName")}
                        onBlur={handleBlur("lastName")}
                        className={
                          errors.lastName
                            ? "border-red-400 focus:ring-red-400"
                            : ""
                        }
                      />
                      {errors.lastName && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Organization */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Organization
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      Organization <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Apollo Hospital, IQVIA"
                      value={form.organization}
                      onChange={setField("organization")}
                      onBlur={handleBlur("organization")}
                      className={
                        errors.organization
                          ? "border-red-400 focus:ring-red-400"
                          : ""
                      }
                    />
                    {errors.organization && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.organization}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>
                      Role <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.role}
                      onValueChange={setSelectField("role")}
                    >
                      <SelectTrigger
                        className={
                          errors.role ? "border-red-400 focus:ring-red-400" : ""
                        }
                      >
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.role && (
                      <p className="text-xs text-red-500 mt-1">{errors.role}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <SearchableSelect
                      value={form.country}
                      onChange={handleCountryChange}
                      options={COUNTRIES}
                      placeholder="Select country"
                      error={!!errors.country}
                    />
                    {errors.country && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.country}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Contact */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Contact
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        className={`pl-9 ${errors.email ? "border-red-400 focus:ring-red-400" : ""}`}
                        type="email"
                        placeholder="user@organization.com"
                        value={form.email}
                        onChange={setField("email")}
                        onBlur={handleBlur("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>
                      Phone <span className="text-red-500">*</span>
                    </Label>
                    {!form.country && (
                      <p className="text-xs text-amber-600 mb-1">
                        Select a country first to auto-fill the dial code
                      </p>
                    )}
                    <div
                      className={`flex rounded-md border overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${errors.phoneNumber ? "border-red-400 focus-within:ring-red-400" : "border-input"}`}
                    >
                      {/* Dial code prefix badge */}
                      <div className="flex items-center gap-1 px-3 bg-gray-50 border-r border-gray-200 shrink-0">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-mono text-gray-600 min-w-[36px]">
                          {form.phonePrefix || "—"}
                        </span>
                      </div>
                      {/* Local number input */}
                      <input
                        type="tel"
                        className="flex-1 px-3 py-2 text-sm bg-background outline-none placeholder:text-muted-foreground"
                        placeholder="98XXXXXXXX"
                        value={form.phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((p) => ({ ...p, phoneNumber: val }));
                          if (errors.phoneNumber)
                            setErrors((p) => ({
                              ...p,
                              phoneNumber: validateField(
                                "phoneNumber",
                                val,
                                form,
                              ),
                            }));
                        }}
                        onBlur={handleBlur("phoneNumber")}
                      />
                    </div>
                    {errors.phoneNumber ? (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.phoneNumber}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Enter the local number — country code is set
                        automatically
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Status */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Account Status
                </h3>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={setSelectField("status")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
              <Button variant="outline" onClick={closePanel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving
                  ? "Saving…"
                  : panel === "create"
                    ? "Add User"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
