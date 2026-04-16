import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resourceService } from '@/features/resources/api/resourceService';

// Helper to flatten policies for the UI
function flattenMatchedPolicies(matched) {
  if (!matched || typeof matched !== 'object') return [];
  const global = (matched.global ?? []).map((p) => ({ ...p, scope: 'global' }));
  const app = (matched.app ?? []).map((p) => ({ ...p, scope: 'app' }));
  return [...global, ...app];
}

// Helper to dynamically style user badges
function getUserDisplayProps(user, index) {
  const name = user.displayName || user.username || user.email || 'User';
  // Get first letter of first two words, or first two letters
  const parts = name.split(' ');
  const initials = parts.length > 1 
    ? (parts[0][0] + parts[1][0]).toUpperCase() 
    : name.substring(0, 2).toUpperCase();
  
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-indigo-100 text-indigo-700',
    'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700',
    'bg-rose-100 text-rose-700'
  ];
  return { name, initials, bg: colors[index % colors.length] };
}

function ResolvedAttributesPanel({ attrs }) {
  const [open, setOpen] = useState(false);
  if (!attrs) return null;

  const namespaces = [
    { label: 'Subject', key: 'subject', color: 'text-blue-700' },
    { label: 'Resource', key: 'resource', color: 'text-purple-700' },
    { label: 'Action', key: 'action', color: 'text-teal-700' },
    { label: 'Environment', key: 'environment', color: 'text-gray-700' },
  ];

  return (
    <div className="border border-gray-200 rounded bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors"
      >
        <span>Resolved Attributes</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {namespaces.map(({ label, key, color }) => {
            const val = attrs[key];
            if (val === undefined || val === null) return null;
            return (
              <div key={key} className="px-3 py-2.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>
                  {label}
                </span>
                <pre className="mt-1.5 text-xs font-mono text-gray-700 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {typeof val === 'object'
                    ? JSON.stringify(val, null, 2)
                    : String(val)}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PolicyTesterPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    subjectId: '',
    actionMode: 'simple',        // 'simple' | 'advanced'
    action: 'view',              // used when actionMode === 'simple'
    actionAttrs: [{ key: 'type', value: '' }], // used when actionMode === 'advanced'
    resourceAttrs: [{ key: '', value: '' }],
    environmentAttrs: [{ key: '', value: '' }],
  });

  const [result, setResult] = useState(null);

  // Fetch user list for quick-select badges — HUB_OWNER only endpoint.
  // retry:false so a 403 for non-owners doesn't spam the network.
  const { data: usersData } = useQuery({
    queryKey: ['abac', 'users'],
    queryFn: () => abacService.listUsers(),
    retry: false,
  });

  // Fetch resources for this app to populate the "Load from resource" quick-select
  const { data: resourcesData } = useQuery({
    queryKey: ['resources-tester', selectedAppKey],
    queryFn: () => resourceService.getResourcesByApplication(selectedAppKey),
    enabled: !!selectedAppKey,
    staleTime: 60_000,
  });
  const testResources = (resourcesData?.data ?? []).filter(r => r.isUnassignedNode !== true).slice(0, 8);

  // Safely extract the users array regardless of backend pagination/wrapper format
  const rawData = usersData?.data;
  const usersArray = Array.isArray(rawData)
    ? rawData
    : (Array.isArray(rawData?.data) ? rawData.data : []);

  // Take up to 4 users (leaving room for the always-visible "Me" badge)
  const quickUsers = usersArray
    .filter((u) => u.id !== currentUser?.id)
    .slice(0, 4);

  const evaluateMutation = useMutation({
    mutationFn: (payload) => abacService.evaluate(selectedAppKey, payload),
    onSuccess: (axiosRes) => {
      const body = axiosRes?.data;
      const decision = body?.data ?? body;
      setResult(decision);
    },
    onError: (err) => {
      const raw =
        err?.response?.data?.message ?? err?.response?.data?.error;
      const errorMsg = Array.isArray(raw)
        ? raw.join('; ')
        : raw || err.message;
      toast({
        title: 'Evaluation failed',
        description: errorMsg,
        variant: 'destructive',
      });
    },
  });

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to test policies.</p>
      </div>
    );
  }

  // Helper to convert array of {key, value} to a standard object
  const arrayToObject = (arr) => {
    return arr.reduce((acc, curr) => {
      if (curr.key.trim()) {
        let val = curr.value;
        // Attempt to parse booleans and numbers, otherwise keep as string
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (!isNaN(val) && val !== '') val = Number(val);
        else {
          try { val = JSON.parse(val); } catch { /* keep as string */ }
        }
        acc[curr.key.trim()] = val;
      }
      return acc;
    }, {});
  };

  const handleTest = (dryRun = false) => {
    try {
      const resObj = arrayToObject(form.resourceAttrs);
      const envObj = arrayToObject(form.environmentAttrs);

      const actionValue = form.actionMode === 'advanced'
        ? arrayToObject(form.actionAttrs)
        : form.action.trim();

      const payload = {
        subject_id: form.subjectId.trim(),
        subjectId: form.subjectId.trim(),
        action: actionValue,
        ...(Object.keys(resObj).length > 0 && { resource: resObj }),
        ...(Object.keys(envObj).length > 0 && { environment: envObj }),
      };
      evaluateMutation.mutate({ ...payload, dryRun });
    } catch {
      toast({
        title: 'Evaluation Error',
        description: 'Failed to parse attributes.',
        variant: 'destructive',
      });
    }
  };

  const updateAttrRow = (type, index, field, val) => {
    const list = [...form[type]];
    list[index][field] = val;
    setForm({ ...form, [type]: list });
  };

  const addAttrRow = (type) => {
    setForm({ ...form, [type]: [...form[type], { key: '', value: '' }] });
  };

  const removeAttrRow = (type, index) => {
    const list = form[type].filter((_, i) => i !== index);
    setForm({ ...form, [type]: list });
  };

  const rows = flattenMatchedPolicies(result?.matchedPolicies);
  const durationMs = result?.durationMs ?? result?.duration_ms;

  return (
    <div className="max-w-6xl mx-auto flex gap-8 h-[calc(100vh-8rem)]">
      
      {/* Input Panel */}
      <div className="w-1/2 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Request Context</h2>
          <p className="text-xs text-gray-500">Simulate an incoming access request.</p>
          {selectedAppName && (
            <p className="text-[11px] text-primary font-medium mt-1 truncate">
              App: {selectedAppName}
            </p>
          )}
        </div>
        
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          
          {/* Subject Section */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject ID</Label>
            <Input
              placeholder="e.g. user-uuid"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Always show current user — works for any role */}
              {currentUser?.id && (
                <button
                  onClick={() => setForm({ ...form, subjectId: currentUser.id })}
                  title={`Use my ID: ${currentUser.id}`}
                  className="flex items-center gap-2 px-2 py-1 bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold bg-primary/15 text-primary">
                    Me
                  </span>
                  <span className="text-xs text-primary font-medium">
                    {currentUser.displayName || currentUser.username || currentUser.email || 'Me'}
                  </span>
                </button>
              )}
              {/* Additional users — only visible to HUB_OWNER */}
              {quickUsers.map((u, i) => {
                const { name, initials, bg } = getUserDisplayProps(u, i);
                return (
                  <button
                    key={u.id}
                    onClick={() => setForm({ ...form, subjectId: u.id })}
                    title={`Use ID: ${u.id}`}
                    className="flex items-center gap-2 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${bg}`}>
                      {initials}
                    </span>
                    <span className="text-xs text-gray-700 font-medium">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resource Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource Attributes</Label>
              {testResources.length > 0 && (
                <span className="text-[10px] text-gray-400">Load from:</span>
              )}
            </div>
            {/* Quick-load from a real resource */}
            {testResources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {testResources.map(r => {
                  const cls = r.assignedApplications?.[0]?.classification;
                  return (
                    <button
                      key={r._id ?? r.id}
                      type="button"
                      title={`Load attrs from: ${r.name}`}
                      onClick={() => {
                        const attrs = [
                          { key: 'id', value: String(r._id ?? r.id) },
                          { key: 'level', value: String(r.level) },
                          ...(cls ? [{ key: 'classification', value: cls.key }] : []),
                          ...(r.resourceExternalId ? [{ key: 'externalId', value: r.resourceExternalId }] : []),
                        ];
                        setForm(f => ({ ...f, resourceAttrs: attrs }));
                      }}
                      className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors max-w-[120px] truncate"
                    >
                      {r.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, resourceAttrs: [{ key: '', value: '' }] }))}
                  className="text-xs px-2 py-1 border border-dashed border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  clear
                </button>
              </div>
            )}
            {form.resourceAttrs.map((attr, i) => (
              <div key={`res-${i}`} className="flex items-center gap-2">
                <Input placeholder="key" value={attr.key} onChange={e => updateAttrRow('resourceAttrs', i, 'key', e.target.value)} className="flex-1 font-mono text-sm" />
                <Input placeholder="value" value={attr.value} onChange={e => updateAttrRow('resourceAttrs', i, 'value', e.target.value)} className="flex-1 font-mono text-sm" />
                <Button variant="ghost" size="icon" onClick={() => removeAttrRow('resourceAttrs', i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </Button>
              </div>
            ))}
            <button onClick={() => addAttrRow('resourceAttrs')} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
              + Add
            </button>
          </div>

          {/* Action Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</Label>
              <div className="flex items-center bg-gray-100 rounded p-0.5 gap-0.5">
                <button
                  onClick={() => setForm({ ...form, actionMode: 'simple' })}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    form.actionMode === 'simple'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setForm({ ...form, actionMode: 'advanced' })}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    form.actionMode === 'advanced'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Object
                </button>
              </div>
            </div>
            {form.actionMode === 'simple' ? (
              <Input
                placeholder="e.g. view, edit, delete"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
              />
            ) : (
              <>
                {form.actionAttrs.map((attr, i) => (
                  <div key={`act-${i}`} className="flex items-center gap-2">
                    <Input placeholder="key" value={attr.key} onChange={e => updateAttrRow('actionAttrs', i, 'key', e.target.value)} className="flex-1 font-mono text-sm" />
                    <Input placeholder="value" value={attr.value} onChange={e => updateAttrRow('actionAttrs', i, 'value', e.target.value)} className="flex-1 font-mono text-sm" />
                    <Button variant="ghost" size="icon" onClick={() => removeAttrRow('actionAttrs', i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </Button>
                  </div>
                ))}
                <button onClick={() => addAttrRow('actionAttrs')} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                  + Add
                </button>
              </>
            )}
          </div>

          {/* Environment Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environment Attributes</Label>
            {form.environmentAttrs.map((attr, i) => (
              <div key={`env-${i}`} className="flex items-center gap-2">
                <Input placeholder="key" value={attr.key} onChange={e => updateAttrRow('environmentAttrs', i, 'key', e.target.value)} className="flex-1 font-mono text-sm" />
                <Input placeholder="value" value={attr.value} onChange={e => updateAttrRow('environmentAttrs', i, 'value', e.target.value)} className="flex-1 font-mono text-sm" />
                <Button variant="ghost" size="icon" onClick={() => removeAttrRow('environmentAttrs', i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </Button>
              </div>
            ))}
            <button onClick={() => addAttrRow('environmentAttrs')} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
              + Add
            </button>
          </div>

        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => handleTest(false)}
            disabled={evaluateMutation.isPending || !form.subjectId.trim()}
          >
            {evaluateMutation.isPending ? 'Evaluating…' : 'Evaluate'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => handleTest(true)}
            disabled={evaluateMutation.isPending || !form.subjectId.trim()}
            title="Includes draft policies in the result without writing to audit logs"
          >
            {evaluateMutation.isPending ? 'Evaluating…' : 'Dry-run'}
          </Button>
        </div>
      </div>

      {/* Output Panel (Remains unchanged) */}
      <div className="w-1/2 flex flex-col bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 bg-white">
          <h2 className="font-semibold text-gray-900">Evaluation Result</h2>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          {!result ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Run an evaluation to see the result
            </div>
          ) : (
            <div className="space-y-6">
              <div
                className={`p-6 rounded-lg border flex items-center justify-between ${
                  result.effect === 'PERMIT'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className={`text-2xl font-bold ${
                        result.effect === 'PERMIT'
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {result.effect}
                    </h3>
                    {result.dryRun && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">
                        Simulation
                      </span>
                    )}
                  </div>
                  {result.effect !== 'DENY' && (
                    <p className="text-sm mt-1 text-green-600">
                      {result.reason || 'Decision reached successfully.'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 uppercase font-semibold">
                    Evaluation Time
                  </span>
                  <p className="text-lg font-mono text-gray-700">
                    {durationMs != null ? `${durationMs} ms` : '—'}
                  </p>
                </div>
              </div>

              {result.effect === 'DENY' && (
                <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <span className="text-red-500 text-lg leading-none mt-0.5">✕</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Access Denied</p>
                    <p className="text-sm text-red-700 mt-0.5">
                      {result.reason || 'A DENY policy matched this request. No ALLOW policy overrode it.'}
                    </p>
                  </div>
                </div>
              )}

              <ResolvedAttributesPanel attrs={result.resolvedAttributes} />

              <div>
                <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">
                  Matched Policies
                </Label>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-600 italic">
                    No policies matched this request.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((p, i) => {
                      const isDecisiveDeny =
                        result.effect === 'DENY' &&
                        p.effect !== 'PERMIT' &&
                        rows.findIndex((r) => r.effect !== 'PERMIT') === i;
                      return (
                        <div
                          key={`${p.scope}-${p.policyId ?? i}`}
                          className={`p-3 rounded text-sm flex justify-between items-center shadow-sm border ${
                            isDecisiveDeny
                              ? 'bg-red-50 border-red-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isDecisiveDeny && (
                              <span className="text-red-500 text-xs shrink-0" title="This policy caused the DENY">▶</span>
                            )}
                            <span className={`font-medium truncate ${isDecisiveDeny ? 'text-red-800' : 'text-gray-800'}`}>
                              {p.policyName ?? p.name ?? 'Policy'}
                            </span>
                            {isDecisiveDeny && (
                              <span className="text-[10px] text-red-600 font-semibold shrink-0">decisive</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {p.isDraft && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">
                                draft
                              </span>
                            )}
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">
                              {p.scope}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                p.effect === 'PERMIT'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {p.effect}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {result.conditionFailedPolicies && result.conditionFailedPolicies.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">
                    Condition Failed
                  </Label>
                  <div className="space-y-2">
                    {result.conditionFailedPolicies.map((p, i) => (
                      <div
                        key={`cf-${p.policyId ?? i}`}
                        className="bg-white border border-gray-200 p-3 rounded text-sm flex justify-between items-center shadow-sm opacity-60"
                      >
                        <span className="font-medium text-gray-700">
                          {p.policyName ?? 'Policy'}
                        </span>
                        <div className="flex items-center gap-2">
                          {p.isDraft && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">
                              draft
                            </span>
                          )}
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">
                            {p.scope}
                          </span>
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">
                            cond. failed
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.targetExcludedCount > 0 && (
                <p className="text-xs text-gray-400 italic">
                  {result.targetExcludedCount} {result.targetExcludedCount === 1 ? 'policy was' : 'policies were'} excluded by target filter (wrong resource type, action, or subject type).
                </p>
              )}

              {result.obligations && result.obligations.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">
                    Obligations Triggered
                  </Label>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded text-xs font-mono overflow-x-auto shadow-inner">
                    {JSON.stringify(result.obligations, null, 2)}
                  </pre>
                </div>
              )}

              {result.skippedDraftPolicies && result.skippedDraftPolicies.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">
                    Draft Policies Not Evaluated
                  </Label>
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                    <p className="text-xs text-amber-700 font-medium">
                      The following policies are in <span className="font-bold">draft</span> status and were skipped. Activate them to include them in evaluation.
                    </p>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {result.skippedDraftPolicies.map((p) => (
                        <li key={p.policyId} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          {p.policyName}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {result.coverageGaps && result.coverageGaps.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">
                    Coverage Gaps
                  </Label>
                  <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded p-3 space-y-1">
                    {result.coverageGaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

