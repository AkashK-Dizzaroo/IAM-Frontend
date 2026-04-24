import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useAbacScope } from '../../abac/contexts/AbacScopeContext';
import { abacService } from '../../abac/api/abacService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function pick(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function toActionLabel(rawAction) {
  const text = String(rawAction || 'unknown').replace(/[_-]+/g, ' ').trim();
  if (!text) return 'Unknown';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function summarizeResource(input) {
  const r = input?.resource;
  if (!r || typeof r !== 'object') return '—';
  const page =
    r.page ||
    r.route ||
    r.path ||
    r.screen ||
    r.tab ||
    r.module ||
    r.type ||
    '';
  const id =
    r.id ||
    r.resourceId ||
    r.resource_id ||
    r.document_id ||
    r.study_id ||
    r.studyId ||
    '';
  if (page && id) return `${page} (${id})`;
  if (page) return String(page);
  if (id) return String(id);
  return '—';
}

export function AuditPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const [effectFilter, setEffectFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: auditRes, isLoading, isError, error } = useQuery({
    queryKey: ['abac', 'audit', selectedAppKey, effectFilter],
    queryFn: () =>
      abacService.listAuditLogs(selectedAppKey, {
        finalEffect: effectFilter !== 'ALL' ? effectFilter : undefined,
        limit: 50,
      }),
    enabled: !!selectedAppKey,
  });

  const body = auditRes?.data;
  const logs = Array.isArray(body?.data) ? body.data : [];

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to view its access logs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full gap-4 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{selectedAppName} Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-1">Historical log of ABAC access evaluations.</p>
        </div>
        <div className="w-full sm:w-48">
          <Select value={effectFilter} onValueChange={setEffectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by effect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Decisions</SelectItem>
              <SelectItem value="PERMIT">Permits Only</SelectItem>
              <SelectItem value="DENY">Denies Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                <th className="px-4 py-3 font-medium whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Subject ID</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Action</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Page / Resource</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Decision</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Duration</th>
                <th className="px-4 py-3 font-medium min-w-[8rem]">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No evaluation logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const id = log.id;
                  const input = pick(log, 'inputAttributes', 'input_attributes');
                  const finalEffect = pick(log, 'finalEffect', 'final_effect');
                  const duration = pick(log, 'evaluationDurationMs', 'evaluation_duration_ms');
                  const created = pick(log, 'createdAt', 'created_at');
                  const userId = pick(log, 'userId', 'user_id');
                  const reason = log.reason ?? '';
                  const action =
                    (typeof input?.action === 'string' ? input.action : input?.action?.type) ??
                    'unknown';
                  const actionLabel = toActionLabel(action);
                  const resourceLabel = summarizeResource(input);

                  const detailPayload = {
                    inputAttributes: input,
                    globalPhaseResult: pick(log, 'globalPhaseResult', 'global_phase_result'),
                    appPhaseResult: pick(log, 'appPhaseResult', 'app_phase_result'),
                    obligationsTriggered: pick(
                      log,
                      'obligationsTriggered',
                      'obligations_triggered'
                    ),
                    reason,
                    finalEffect,
                  };

                  return (
                    <React.Fragment key={id}>
                      <tr
                        className={cn(
                          'hover:bg-gray-50 transition-colors cursor-pointer'
                        )}
                        onClick={() =>
                          setSelectedLog({
                            id,
                            created,
                            userId: userId ?? input?.subject_id ?? 'anonymous',
                            action: actionLabel,
                            finalEffect,
                            duration,
                            reason: reason || '—',
                            resourceLabel,
                            input,
                            globalPhaseResult: pick(log, 'globalPhaseResult', 'global_phase_result'),
                            appPhaseResult: pick(log, 'appPhaseResult', 'app_phase_result'),
                            obligationsTriggered: pick(log, 'obligationsTriggered', 'obligations_triggered'),
                          })
                        }
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {created
                            ? formatDistanceToNow(new Date(created), { addSuffix: true })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-900 max-w-[10rem] truncate">
                          {userId ?? input?.subject_id ?? 'anonymous'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                          {actionLabel}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-[14rem] truncate" title={resourceLabel}>
                          {resourceLabel}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              finalEffect === 'PERMIT'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {finalEffect}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                          {duration != null ? `${duration} ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-md">
                          <span className="line-clamp-2" title={reason}>
                            {reason || '—'}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Action Details</DialogTitle>
            <DialogDescription>
              Human-readable details for the selected action.
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border p-2">
                  <p className="text-xs text-gray-500">When</p>
                  <p className="font-medium">{selectedLog.created ? new Date(selectedLog.created).toLocaleString() : '—'}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-gray-500">Subject</p>
                  <p className="font-mono text-xs">{selectedLog.userId}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-gray-500">Action</p>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-gray-500">Page / Resource</p>
                  <p className="font-medium">{selectedLog.resourceLabel || '—'}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-gray-500">Decision</p>
                  <p className={cn('font-semibold', selectedLog.finalEffect === 'PERMIT' ? 'text-green-700' : 'text-red-700')}>
                    {selectedLog.finalEffect || '—'}
                  </p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-medium">{selectedLog.duration != null ? `${selectedLog.duration} ms` : '—'}</p>
                </div>
                <div className="rounded border p-2 col-span-2">
                  <p className="text-xs text-gray-500">Application</p>
                  <p className="font-medium">{selectedAppName || selectedAppKey}</p>
                </div>
              </div>
              <div className="rounded border p-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-1">Reason</p>
                <p className="text-gray-800">{selectedLog.reason}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
