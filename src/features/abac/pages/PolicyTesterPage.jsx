import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';
import { useAbacScope } from '../contexts/AbacScopeContext';

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

export function PolicyTesterPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { toast } = useToast();

  const [form, setForm] = useState({
    subjectId: '',
    action: 'view',
    resourceAttrs: [{ key: '', value: '' }],
    environmentAttrs: [{ key: '', value: '' }],
  });

  const [result, setResult] = useState(null);

  // Fetch real users from backend for the quick-select badges
  const { data: usersData } = useQuery({
    queryKey: ['abac', 'users'],
    queryFn: () => abacService.listUsers(),
  });
  
  // Safely extract the users array regardless of backend pagination/wrapper format
  const rawData = usersData?.data;
  const usersArray = Array.isArray(rawData)
    ? rawData
    : (Array.isArray(rawData?.data) ? rawData.data : []);

  // Take up to 5 users to keep the UI clean
  const quickUsers = usersArray.slice(0, 5);

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

  const handleTest = () => {
    try {
      const resObj = arrayToObject(form.resourceAttrs);
      const envObj = arrayToObject(form.environmentAttrs);

      const payload = {
        subject_id: form.subjectId.trim(),
        subjectId: form.subjectId.trim(),
        action: form.action.trim(),
        ...(Object.keys(resObj).length > 0 && { resource: resObj }),
        ...(Object.keys(envObj).length > 0 && { environment: envObj }),
      };
      evaluateMutation.mutate(payload);
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
            {quickUsers?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
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
            )}
          </div>

          {/* Resource Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource Attributes</Label>
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
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</Label>
            <Input
              placeholder="e.g. view, edit, delete"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            />
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
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <Button
            className="w-full"
            onClick={handleTest}
            disabled={evaluateMutation.isPending || !form.subjectId.trim()}
          >
            {evaluateMutation.isPending ? 'Evaluating…' : 'Evaluate'}
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
                  <h3
                    className={`text-2xl font-bold ${
                      result.effect === 'PERMIT'
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {result.effect}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      result.effect === 'PERMIT'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {result.reason || 'Decision reached successfully.'}
                  </p>
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
                    {rows.map((p, i) => (
                      <div
                        key={`${p.scope}-${p.policyId ?? i}`}
                        className="bg-white border border-gray-200 p-3 rounded text-sm flex justify-between items-center shadow-sm"
                      >
                        <span className="font-medium text-gray-800">
                          {p.policyName ?? p.name ?? 'Policy'}
                        </span>
                        <div className="flex items-center gap-2">
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
                    ))}
                  </div>
                )}
              </div>

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

