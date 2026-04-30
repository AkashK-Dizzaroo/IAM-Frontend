import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilityService } from '@/features/facilities/api/facilityService';
import { useAuth } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
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
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  MapPin,
  Phone,
  Mail,
  ChevronDown,
} from 'lucide-react';

const FACILITY_TYPES = [
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'CLINIC', label: 'Clinic' },
  { value: 'RESEARCH_CENTER', label: 'Research Center' },
  { value: 'PHYSICIAN_OFFICE', label: 'Physician Office' },
  { value: 'OTHER', label: 'Other' },
];

const STATES_BY_COUNTRY = {
  'Australia': ['Australian Capital Territory','New South Wales','Northern Territory','Queensland','South Australia','Tasmania','Victoria','Western Australia'],
  'Brazil': ['Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'],
  'Canada': ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon'],
  'China': ['Anhui','Beijing','Chongqing','Fujian','Gansu','Guangdong','Guangxi','Guizhou','Hainan','Hebei','Heilongjiang','Henan','Hubei','Hunan','Inner Mongolia','Jiangsu','Jiangxi','Jilin','Liaoning','Ningxia','Qinghai','Shaanxi','Shandong','Shanghai','Shanxi','Sichuan','Tianjin','Tibet','Xinjiang','Yunnan','Zhejiang'],
  'Germany': ['Baden-Württemberg','Bavaria','Berlin','Brandenburg','Bremen','Hamburg','Hesse','Lower Saxony','Mecklenburg-Vorpommern','North Rhine-Westphalia','Rhineland-Palatinate','Saarland','Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia'],
  'India': ['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'],
  'Malaysia': ['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'],
  'Mexico': ['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'],
  'Nigeria': ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nassarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'],
  'Pakistan': ['Azad Kashmir','Balochistan','Gilgit-Baltistan','Islamabad Capital Territory','Khyber Pakhtunkhwa','Punjab','Sindh'],
  'Russia': ['Altai Krai','Altai Republic','Amur Oblast','Arkhangelsk Oblast','Astrakhan Oblast','Belgorod Oblast','Bryansk Oblast','Chechen Republic','Chelyabinsk Oblast','Chukotka Autonomous Okrug','Chuvash Republic','Ingushetia','Irkutsk Oblast','Ivanovo Oblast','Jewish Autonomous Oblast','Kabardino-Balkaria','Kaliningrad Oblast','Kalmykia','Kaluga Oblast','Kamchatka Krai','Karachay-Cherkessia','Karelia','Kemerovo Oblast','Khabarovsk Krai','Khakassia','Khanty-Mansi Autonomous Okrug','Kirov Oblast','Komi Republic','Kostroma Oblast','Krasnodar Krai','Krasnoyarsk Krai','Kurgan Oblast','Kursk Oblast','Leningrad Oblast','Lipetsk Oblast','Magadan Oblast','Mari El','Mordovia','Moscow','Moscow Oblast','Murmansk Oblast','Nenets Autonomous Okrug','Nizhny Novgorod Oblast','North Ossetia','Novgorod Oblast','Novosibirsk Oblast','Omsk Oblast','Orenburg Oblast','Oryol Oblast','Penza Oblast','Perm Krai','Primorsky Krai','Pskov Oblast','Rostov Oblast','Ryazan Oblast','Saint Petersburg','Sakha Republic','Sakhalin Oblast','Samara Oblast','Saratov Oblast','Smolensk Oblast','Stavropol Krai','Sverdlovsk Oblast','Tambov Oblast','Tatarstan','Tomsk Oblast','Tula Oblast','Tuva Republic','Tver Oblast','Tyumen Oblast','Udmurtia','Ulyanovsk Oblast','Vladimir Oblast','Volgograd Oblast','Vologda Oblast','Voronezh Oblast','Yamalo-Nenets Autonomous Okrug','Yaroslavl Oblast','Zabaykalsky Krai'],
  'South Africa': ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'],
  'United States': ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'],
};

const COUNTRIES_WITHOUT_STATES = new Set([
  'United Kingdom', 'Ireland', 'Singapore', 'Hong Kong', 'Monaco',
  'Luxembourg', 'Malta', 'Cyprus', 'Iceland', 'Liechtenstein',
]);

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh',
  'Belgium','Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia',
  'Croatia','Cyprus','Czech Republic','Denmark','Egypt','Estonia','Finland',
  'France','Germany','Greece','Hong Kong','Hungary','Iceland','India','Indonesia',
  'Ireland','Israel','Italy','Japan','Jordan','Kenya','Laos','Latvia','Lebanon',
  'Liechtenstein','Lithuania','Luxembourg','Malaysia','Malta','Mexico','Monaco',
  'Myanmar','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru',
  'Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Serbia',
  'Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain',
  'Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Venezuela','Vietnam','Other',
].sort();

/** Searchable dropdown used for country and state selects in the form */
function SearchableSelect({ value, onChange, options, placeholder, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  useEffect(() => {
    if (!open) setQuery('');
    else setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
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
              <li className="px-3 py-2 text-sm text-gray-400 text-center">No results</li>
            )}
            {filtered.map((opt) => (
              <li
                key={opt}
                className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${opt === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
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

const EMPTY_FORM = {
  name: '',
  facilityType: '',
  campusName: '',
  street: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  deptName: '',
  deptAddress: '',
  deptPhone: '',
  deptEmail: '',
  status: 'ACTIVE',
};

function normalizeList(res) {
  const body = res?.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

function statusBadge(status) {
  if (status === 'ACTIVE') return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (status === 'INACTIVE') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Inactive</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Archived</Badge>;
}

function typeBadge(type) {
  const colors = {
    HOSPITAL: 'bg-blue-100 text-blue-800 border-blue-200',
    CLINIC: 'bg-purple-100 text-purple-800 border-purple-200',
    RESEARCH_CENTER: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    PHYSICIAN_OFFICE: 'bg-teal-100 text-teal-800 border-teal-200',
    OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  const label = FACILITY_TYPES.find(t => t.value === type)?.label ?? type;
  return <Badge className={colors[type] ?? colors.OTHER}>{label}</Badge>;
}

export const FacilitiesPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveRoles } = useAuth();
  const isHubOwner = effectiveRoles.isHubOwner;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panel, setPanel] = useState(null); // null | 'create' | facilityObject
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['facilities', { search, typeFilter, statusFilter }],
    queryFn: () =>
      facilityService.list({
        search: search || undefined,
        facilityType: typeFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
      }),
    staleTime: 30_000,
  });

  const facilities = useMemo(() => normalizeList(rawData), [rawData]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['facilities'] });

  const createMutation = useMutation({
    mutationFn: (data) => facilityService.create(data),
    onSuccess: () => {
      toast({ title: 'Facility created' });
      invalidate();
      closePanel();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.response?.data?.error ?? err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => facilityService.update(id, data),
    onSuccess: () => {
      toast({ title: 'Facility updated' });
      invalidate();
      closePanel();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.response?.data?.error ?? err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => facilityService.remove(id),
    onSuccess: () => {
      toast({ title: 'Facility deleted' });
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.response?.data?.error ?? err.message, variant: 'destructive' }),
  });

  const closePanel = () => setPanel(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setPanel('create');
  };

  const openEdit = (facility) => {
    setForm({
      name: facility.name ?? '',
      facilityType: facility.facilityType ?? '',
      campusName: facility.campusName ?? '',
      street: facility.street ?? '',
      addressLine2: facility.addressLine2 ?? '',
      city: facility.city ?? '',
      state: facility.state ?? '',
      country: facility.country ?? '',
      postalCode: facility.postalCode ?? '',
      deptName: facility.deptName ?? '',
      deptAddress: facility.deptAddress ?? '',
      deptPhone: facility.deptPhone ?? '',
      deptEmail: facility.deptEmail ?? '',
      status: facility.status ?? 'ACTIVE',
    });
    setPanel(facility);
  };

  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setSelectField = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = () => {
    if (!form.name.trim()) return toast({ title: 'Validation', description: 'Facility name is required', variant: 'destructive' });
    if (!form.facilityType) return toast({ title: 'Validation', description: 'Facility type is required', variant: 'destructive' });
    if (!form.street.trim()) return toast({ title: 'Validation', description: 'Street address is required', variant: 'destructive' });
    if (!form.city.trim()) return toast({ title: 'Validation', description: 'City is required', variant: 'destructive' });
    if (!form.country) return toast({ title: 'Validation', description: 'Country is required', variant: 'destructive' });
    if (!form.postalCode.trim()) return toast({ title: 'Validation', description: 'Postal code is required', variant: 'destructive' });

    const payload = {
      name: form.name.trim(),
      facilityType: form.facilityType,
      campusName: form.campusName.trim() || undefined,
      street: form.street.trim(),
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim() || undefined,
      country: form.country,
      postalCode: form.postalCode.trim(),
      deptName: form.deptName.trim() || undefined,
      deptAddress: form.deptAddress.trim() || undefined,
      deptPhone: form.deptPhone.trim() || undefined,
      deptEmail: form.deptEmail.trim() || undefined,
      status: form.status,
    };

    if (panel === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: panel.id, data: payload });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const showState = form.country && !COUNTRIES_WITHOUT_STATES.has(form.country);
  const stateOptions = STATES_BY_COUNTRY[form.country] ?? null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Facilities</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage physical locations and departments
          </p>
        </div>
        {isHubOwner && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Facility
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search facilities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter || '__all__'} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {FACILITY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
        {(search || typeFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-gray-500"
            onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && facilities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">No facilities found</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            {search || typeFilter || statusFilter
              ? 'Try adjusting your filters'
              : 'Add your first facility to get started'}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && facilities.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Facility</th>
                <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="px-4 py-3 font-medium text-gray-600">Department</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                {isHubOwner && <th className="px-4 py-3 font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {facilities.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{f.name}</div>
                    {f.campusName && <div className="text-xs text-gray-500">{f.campusName}</div>}
                    <div className="font-mono text-[11px] text-gray-400">{f.facilityCode}</div>
                  </td>
                  <td className="px-4 py-3">{typeBadge(f.facilityType)}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700 text-xs leading-5">
                      <div>{f.street}{f.addressLine2 ? `, ${f.addressLine2}` : ''}</div>
                      <div>{[f.city, f.state, f.postalCode].filter(Boolean).join(', ')}</div>
                      <div className="text-gray-500">{f.country}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {f.deptName ? (
                      <div className="text-xs text-gray-700 leading-5">
                        <div className="font-medium">{f.deptName}</div>
                        {f.deptPhone && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Phone className="h-3 w-3" />{f.deptPhone}
                          </div>
                        )}
                        {f.deptEmail && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Mail className="h-3 w-3" />{f.deptEmail}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(f.status)}</td>
                  {isHubOwner && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Delete Facility</h3>
              <p className="text-sm text-gray-600 mb-5">
                Are you sure you want to delete <span className="font-medium">{deleteTarget.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create / Edit slide panel */}
      {panel !== null && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
          <div className="fixed right-0 top-0 h-full w-full max-w-[520px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-base">
                {panel === 'create' ? 'Add Facility' : 'Edit Facility'}
              </h2>
              <Button variant="ghost" size="sm" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

              {/* Section: Basic info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Facility Name <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input className="pl-9" placeholder="e.g. St. Mary's Hospital" value={form.name} onChange={setField('name')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Facility Type <span className="text-red-500">*</span></Label>
                    <Select value={form.facilityType} onValueChange={setSelectField('facilityType')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FACILITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Campus Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input className="pl-9" placeholder="Optional campus name" value={form.campusName} onChange={setField('campusName')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={setSelectField('status')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section: Address */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Address</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Street Address <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input className="pl-9" placeholder="Street address, building number" value={form.street} onChange={setField('street')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address Line 2</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input className="pl-9" placeholder="Suite, floor, unit (optional)" value={form.addressLine2} onChange={setField('addressLine2')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>City <span className="text-red-500">*</span></Label>
                      <Input placeholder="City" value={form.city} onChange={setField('city')} />
                    </div>
                    {showState && (
                      <div className="space-y-1.5">
                        <Label>State / Province</Label>
                        {stateOptions ? (
                          <SearchableSelect
                            value={form.state}
                            onChange={(val) => setForm((p) => ({ ...p, state: val }))}
                            options={stateOptions}
                            placeholder="Select state"
                          />
                        ) : (
                          <Input placeholder="State or Province" value={form.state} onChange={setField('state')} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Country <span className="text-red-500">*</span></Label>
                      <SearchableSelect
                        value={form.country}
                        onChange={(val) => setForm((p) => ({ ...p, country: val, state: '' }))}
                        options={COUNTRIES}
                        placeholder="Select country"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postal / ZIP Code <span className="text-red-500">*</span></Label>
                      <Input placeholder="Postal code" value={form.postalCode} onChange={setField('postalCode')} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Department */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-900 mb-1">Department Information</h3>
                <p className="text-xs text-gray-500 mb-3">Optional department contact details</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Department Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input className="pl-9" placeholder="Department name" value={form.deptName} onChange={setField('deptName')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input className="pl-9" placeholder="Department address" value={form.deptAddress} onChange={setField('deptAddress')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input className="pl-9" type="tel" placeholder="+1 (555) 000-0000" value={form.deptPhone} onChange={setField('deptPhone')} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input className="pl-9" type="email" placeholder="dept@org.com" value={form.deptEmail} onChange={setField('deptEmail')} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
              <Button variant="outline" onClick={closePanel} disabled={saving}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : panel === 'create' ? 'Create Facility' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
