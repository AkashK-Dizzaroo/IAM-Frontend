import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { auditService } from '../api/auditService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/** First defined, non-null value among keys. */
function pick(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function titleize(raw) {
  const text = String(raw || '').replace(/[_-]+/g, ' ').trim();
  if (!text) return 'Unknown action';
  // Already a friendly name (has spaces / mixed case)? leave it.
  if (/\s/.test(text) && /[a-z]/.test(text)) return text;
  return text
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalize a raw audit row (either shape: business-audit event or the
 * read-only auto-audit row) into a flat view model: who / what / when / where.
 *
 * "Who" comes from the actor identity embedded on the row by the backend
 * (actor.email / actor.name) — no extra user-directory call, so viewing the
 * audit trail needs no user-management permission. Rows written before the
 * backend started embedding the actor fall back to the raw id.
 */
function toViewModel(log) {
  const input = pick(log, 'inputAttributes', 'input_attributes') || {};
  const actor = input.actor || {};
  const page = input.page || {};
  const action = input.action;

  // WHO — email, then name, then raw id (old rows), then "Anonymous".
  const userId = pick(log, 'userId', 'user_id') ?? actor.userId ?? input.subject_id;
  const email = actor.email || null;
  const name = actor.name || actor.displayName || null;
  const who =
    email ||
    name ||
    (userId && userId !== 'anonymous' ? userId : 'Anonymous');
  const whoIsId = who === userId && UUID_RE.test(String(who));

  // WHAT — friendly action name (+ resource type/name when present).
  const actionName =
    typeof action === 'string'
      ? action
      : action?.name || titleize(action?.type) || 'Unknown action';
  const resourceType = typeof action === 'object' ? action?.resourceType : undefined;
  const resourceName = typeof action === 'object' ? action?.name : undefined;
  const what = titleize(actionName);

  // WHERE — the UI page that triggered the call; route as secondary detail.
  const wherePage = page.path && page.path !== 'unknown' ? page.path : null;
  const whereRoute = page.route || input.route || null;

  // WHICH APP — the global endpoint attaches { key, name }; null = Hub/Platform.
  const app = log.application || null;
  const appName = app ? (app.name || app.key) : null;
  const appKey = app?.key || null;

  return {
    id: log.id,
    when: pick(log, 'createdAt', 'created_at'),
    who,
    whoIsId,
    email,
    name,
    userId,
    what,
    resourceType,
    resourceName,
    appName,
    appKey,
    wherePage,
    whereRoute,
    method: input.method || null,
    duration: pick(log, 'evaluationDurationMs', 'evaluation_duration_ms'),
    reason: log.reason ?? '',
    changes: input.changes || null,
    requestId: pick(log, 'appPhaseResult', 'app_phase_result')?.requestId,
    raw: log,
    input,
  };
}

export function AuditPage() {
  const [selected, setSelected] = useState(null);

  // Centralized, cross-application trail (Hub Owner). Always fresh — never cached.
  const { data: auditRes, isLoading, isError, error } = useQuery({
    queryKey: ['abac', 'audit', 'global'],
    queryFn: () => auditService.listGlobalLogs({ limit: 100 }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const body = auditRes?.data;
  const rows = (Array.isArray(body?.data) ? body.data : []).map(toViewModel);

  return (
    <div className="flex flex-col h-full gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Centralized log across all applications — who did what, when, and on which page.
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error?.response?.data?.error ?? error?.message ?? 'Failed to load audit trail.'}
        </div>
      )}

      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-12rem)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">When</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Who</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Application</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Action</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Page</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No activity logged yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {r.when ? (
                        <span title={format(new Date(r.when), 'PPpp')}>
                          {formatDistanceToNow(new Date(r.when), { addSuffix: true })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap max-w-[16rem] truncate" title={r.email || r.userId || ''}>
                      {r.who === 'Anonymous' ? (
                        <span className="text-gray-400 italic">Anonymous</span>
                      ) : r.whoIsId ? (
                        // Could not resolve to a person — show id, flagged.
                        <span className="font-mono text-[11px] text-gray-500" title="Unknown / deleted user">{r.who}</span>
                      ) : (
                        <div className="flex flex-col leading-tight">
                          <span className="text-gray-900">{r.name || r.email}</span>
                          {r.name && r.email && (
                            <span className="text-[11px] text-gray-400">{r.email}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.appName ? (
                        <span
                          className="inline-flex items-center rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-medium"
                          title={r.appKey || r.appName}
                        >
                          {r.appName}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded bg-gray-100 text-gray-600 px-2 py-0.5 text-[11px] font-medium"
                          title="Hub / Platform-level action (not scoped to an application)"
                        >
                          Hub / Platform
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className="font-medium text-gray-800">{r.what}</span>
                      {r.resourceName && (
                        <span className="text-gray-400"> · {r.resourceName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap max-w-[14rem] truncate" title={r.wherePage || r.whereRoute || ''}>
                      {r.wherePage ? (
                        <span className="font-mono text-[11px] text-gray-700">{r.wherePage}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                      {r.duration != null ? `${Math.round(r.duration)} ms` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.what || 'Audit Details'}</DialogTitle>
            <DialogDescription>
              {selected?.when ? format(new Date(selected.when), 'PPpp') : 'Activity detail'}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Who">
                  {selected.name || selected.email || selected.userId || 'Anonymous'}
                  {selected.name && selected.email && (
                    <span className="block text-[11px] font-normal text-gray-400">{selected.email}</span>
                  )}
                </Field>
                <Field label="Action">
                  {selected.what}
                  {selected.method && <span className="text-gray-400 font-mono text-xs"> ({selected.method})</span>}
                </Field>
                <Field label="Resource">
                  {selected.resourceType
                    ? `${selected.resourceType}${selected.resourceName ? `: ${selected.resourceName}` : ''}`
                    : '—'}
                </Field>
                <Field label="Page">
                  {selected.wherePage || '—'}
                </Field>
                <Field label="API Route">
                  <span className="font-mono text-xs">{selected.whereRoute || '—'}</span>
                </Field>
                <Field label="Duration">
                  {selected.duration != null ? `${Math.round(selected.duration)} ms` : '—'}
                </Field>
                <Field label="Application">
                  {selected.appName || 'Hub / Platform'}
                </Field>
              </div>

              {selected.reason && (
                <div className="rounded border p-3 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Reason</p>
                  <p className="text-gray-800">{selected.reason}</p>
                </div>
              )}

              {selected.changes && (
                <div className="rounded border p-3">
                  <p className="text-xs text-gray-500 mb-2">What changed</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Before</p>
                      <pre className="text-[11px] bg-red-50 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                        {selected.changes.before ? JSON.stringify(selected.changes.before, null, 2) : '(none — created)'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">After</p>
                      <pre className="text-[11px] bg-green-50 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                        {selected.changes.after ? JSON.stringify(selected.changes.after, null, 2) : '(none — deleted)'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {selected.requestId && (
                <p className="text-[10px] text-gray-400 font-mono">request: {selected.requestId}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded border p-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium break-words">{children}</p>
    </div>
  );
}
