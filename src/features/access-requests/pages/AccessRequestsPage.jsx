import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, CheckCircle, XCircle, Clock, Ban, RefreshCw, Inbox, X,
} from 'lucide-react';
import { accessRequestService } from '../api/accessRequestService';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  pending:   'bg-warning-soft text-warning border-warning/30',
  approved:  'bg-success-soft text-success border-success/25',
  rejected:  'bg-destructive-soft text-destructive border-destructive/25',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const STATUS_ICON = {
  pending:   <Clock    className="w-3 h-3 mr-1" />,
  approved:  <CheckCircle className="w-3 h-3 mr-1" />,
  rejected:  <XCircle  className="w-3 h-3 mr-1" />,
  cancelled: <Ban      className="w-3 h-3 mr-1" />,
};

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled'];

function InfoRow({ label, children }) {
  return (
    <div className="flex">
      <span className="font-semibold w-36 text-gray-500 uppercase text-[10px] self-center shrink-0">{label}</span>
      <span className="text-gray-900 text-sm">{children}</span>
    </div>
  );
}

function formatAttrValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

// ── Review modal ──────────────────────────────────────────────────────────────

function StepChip({ done }) {
  return done ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-success/25 bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
      <CheckCircle className="h-3 w-3" /> Approved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
      <Clock className="h-3 w-3" /> Pending approval
    </span>
  );
}

// Unified stacked review section — replaces the old tab-per-step modal so
// reviewers see every pending sub-approval at once. Pending sections are
// highlighted with the warning token; approved ones settle to neutral.
function ReviewSection({ title, done, children }) {
  return (
    <section
      className={`space-y-3 rounded-md border p-4 ${
        done ? 'border-gray-200 bg-white' : 'border-warning/40 bg-warning-soft/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <StepChip done={done} />
      </div>
      {children}
    </section>
  );
}

function ReviewNotesField({ id, value, onChange }) {
  return (
    <div className="space-y-1 pt-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">Review Notes (optional)</label>
      <textarea
        id={id}
        className="w-full resize-none rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        rows={2}
        placeholder="Any notes for the requester…"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function ApprovedBanner({ label, approvedAt }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success-soft px-3 py-2.5">
      <CheckCircle className="h-4 w-4 shrink-0 text-success" />
      <span className="text-sm font-medium text-success">{label}</span>
      {approvedAt && (
        <span className="ml-auto text-xs text-success/80">
          {new Date(approvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      )}
    </div>
  );
}

function ReviewModal({ request, action, onConfirm, onCancel, loading, preservedNotes = '' }) {
  const [notes, setNotes] = useState(preservedNotes);

  const isApprove = action === 'approve';
  const appAttributes = request.pendingAppAttributes ?? null;
  const hasAppAttrs = appAttributes && Object.keys(appAttributes).length > 0;
  const hasPendingAttrs = hasAppAttrs && Object.values(appAttributes).some(m => m.status === 'PENDING_APPROVAL');
  const progress = request.requestedAttributes?._iamApprovalProgress;
  const resourceApproved = Boolean(progress?.resourceApprovedAt);
  const hasResourceStep = Boolean(
    request.requestedResource ||
    request.requestedAttributes?.role ||
    request.requestedAttributes?.requestedRole
  );
  const isTwoStep = hasAppAttrs && hasResourceStep;

  const requesterName = [request.requester?.firstName, request.requester?.lastName].filter(Boolean).join(' ') || request.requester?.email || '—';

  // For reject: simple single-panel layout
  if (!isApprove) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold text-destructive">Reject Access Request</h3>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2.5 rounded-md border bg-gray-50 p-4">
            <InfoRow label="Requester">
              <span className="font-medium">{requesterName}</span>
            </InfoRow>
            <InfoRow label="Application">{request.application?.name || request.application?.key || '—'}</InfoRow>
            <InfoRow label="Resource">
              {request.requestedResource
                ? (request.requestedResource.name || request.requestedResource.resourceExternalId)
                : <span className="text-gray-400 italic">Global Access</span>}
            </InfoRow>
          </div>
          <div className="space-y-1">
            <label htmlFor="reject-notes" className="text-sm font-medium text-gray-700">Reason for rejection (optional)</label>
            <textarea
              id="reject-notes"
              className="w-full resize-none rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
              rows={2}
              placeholder="Reason for rejection…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="h-10 rounded-md border border-input px-4 text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onConfirm(notes, {}, null)}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Approve: unified vertically stacked sections — no tab fishing.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Approve Access Request</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {requesterName} · {request.application?.name || request.application?.key || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Step 1: Application Attributes ── */}
        {hasAppAttrs && (
          <ReviewSection
            title={isTwoStep ? 'Step 1 · Application Attributes' : 'Application Attributes'}
            done={!hasPendingAttrs}
          >
            <p className="text-xs text-gray-500">
              App-specific attributes submitted by the user. Approving will promote any pending ones to active.
            </p>
            <div className="space-y-2.5 rounded-md border bg-white/70 p-4">
              {Object.entries(appAttributes).map(([key, meta]) => {
                const isPending = meta.status === 'PENDING_APPROVAL';
                const isApproved = meta.status === 'APPROVED';
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-[10px] font-semibold uppercase text-gray-500">
                      {meta.displayName || key}
                      <span className="ml-1 font-mono font-normal text-gray-400">({meta.dataType})</span>
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-gray-900" title={formatAttrValue(meta.value)}>
                      {formatAttrValue(meta.value)}
                    </span>
                    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                      isPending  ? 'border-warning/30 bg-warning-soft text-warning' :
                      isApproved ? 'border-success/25 bg-success-soft text-success' :
                                   'border-border bg-muted text-muted-foreground'
                    }`}>
                      {isPending ? 'Pending' : isApproved ? 'Approved' : meta.status}
                    </span>
                  </div>
                );
              })}
            </div>
            {hasPendingAttrs ? (
              <>
                <ReviewNotesField id="review-notes-attrs" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="flex justify-end pt-1">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-success px-4 text-sm font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => onConfirm(notes, {}, 'app_attributes')}
                    disabled={loading}
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle className="h-4 w-4" />
                    Approve Application Attributes
                  </button>
                </div>
              </>
            ) : (
              <ApprovedBanner label="Application attributes approved" approvedAt={progress?.appAttributesApprovedAt} />
            )}
          </ReviewSection>
        )}

        {/* ── Step 2: Resource Access ── */}
        <ReviewSection
          title={isTwoStep ? 'Step 2 · Resource Access' : 'Resource Access'}
          done={resourceApproved}
        >
          <p className="text-xs text-gray-500">
            Role and resource details from the request. Approving will sync these to the user&apos;s app attributes and mark the request as approved.
          </p>
          <div className="space-y-2.5 rounded-md border bg-white/70 p-4">
            <InfoRow label="Requester">
              <span className="font-medium">{requesterName}</span>
            </InfoRow>
            <InfoRow label="Application">
              {request.application?.name || request.application?.key || '—'}
            </InfoRow>
            <InfoRow label="Requested Role">
              {(request.requestedAttributes?.role || request.requestedAttributes?.requestedRole)
                ? <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">{request.requestedAttributes?.role || request.requestedAttributes?.requestedRole}</span>
                : <span className="text-gray-400 italic">—</span>}
            </InfoRow>
            <InfoRow label="Resource">
              {request.requestedResource
                ? <span className="break-all">{request.requestedResource.name || request.requestedResource.resourceExternalId}{request.requestedResource.level ? ` (L${request.requestedResource.level})` : ''}</span>
                : <span className="text-gray-400 italic">Global Access</span>}
            </InfoRow>
            {request.requestedAttributes?.justification && (
              <InfoRow label="Justification">
                <span className="line-clamp-3 text-gray-600" title={request.requestedAttributes.justification}>
                  {request.requestedAttributes.justification}
                </span>
              </InfoRow>
            )}
          </div>
          {resourceApproved ? (
            <ApprovedBanner label="Resource access approved" approvedAt={progress?.resourceApprovedAt} />
          ) : (
            <>
              <ReviewNotesField id="review-notes-resource" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex justify-end pt-1">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-success px-4 text-sm font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => onConfirm(notes, {}, 'resource')}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CheckCircle className="h-4 w-4" />
                  Approve Resource Access
                </button>
              </div>
            </>
          )}
        </ReviewSection>

        <div className="flex justify-end pt-1">
          <button
            className="h-10 rounded-md border border-input px-4 text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const AccessRequestsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [modal, setModal] = useState(null); // { request, action }

  const { data: allData, isLoading, isError, refetch } = useQuery({
    queryKey: ['access-requests', 'all'],
    queryFn: () => accessRequestService.getAllAccessRequests({ limit: 500 }),
    select: (res) => {
      const rows = res?.data ?? res?.data?.data ?? [];
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 30_000,
  });

  const rows = (allData ?? []).filter((r) =>
    statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter
  );

  const counts = (allData ?? []).reduce((acc, r) => {
    const s = (r.status || '').toLowerCase();
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const approveMutation = useMutation({
    mutationFn: ({ id, notes, attributes, approvalScope }) =>
      accessRequestService.approveAccessRequest(id, notes, attributes, approvalScope),
    onSuccess: (payload, vars) => {
      const row = payload?.data;
      const stillPending = row?.status === 'pending';

      let title = 'Request approved';
      if (vars.approvalScope === 'app_attributes') {
        title = stillPending
          ? 'Application attributes approved — now approve the resource step'
          : 'Application attributes approved';
      } else if (vars.approvalScope === 'resource') {
        title = stillPending
          ? 'Resource step saved — approve application attributes to finish'
          : 'Resource request approved';
      }

      toast({ title });
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['abac', 'users'] });

      // Keep modal open and switch to the next pending tab so the reviewer
      // doesn't have to re-open the modal from the table.
      if (stillPending && vars.approvalScope === 'app_attributes' && row) {
        // App attrs done → still needs resource step
        setModal((prev) => ({
          ...prev,
          request: row,
          initialTab: 'resource',
          preservedNotes: vars.notes ?? '',
        }));
      } else if (stillPending && vars.approvalScope === 'resource' && row) {
        // Resource done → still needs app_attributes step
        setModal((prev) => ({
          ...prev,
          request: row,
          initialTab: 'app_attributes',
          preservedNotes: vars.notes ?? '',
        }));
      } else {
        setModal(null);
      }
    },
    onError: (err) => toast({ title: 'Approve failed', description: err?.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => accessRequestService.rejectAccessRequest(id, notes),
    onSuccess: () => {
      toast({ title: 'Request rejected' });
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['abac', 'users'] });
      setModal(null);
    },
    onError: (err) => toast({ title: 'Reject failed', description: err?.message, variant: 'destructive' }),
  });

  const actionLoading = approveMutation.isPending || rejectMutation.isPending;

  const handleConfirm = (notes, attributes = {}, approvalScope = undefined) => {
    if (!modal) return;
    const { request, action } = modal;
    if (action === 'approve') {
      approveMutation.mutate({ id: request.id, notes, attributes, approvalScope });
    } else {
      rejectMutation.mutate({ id: request.id, notes });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Access Approvals</h2>
          <p className="text-sm text-gray-500 mt-1">Review and action application access requests</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-2 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
        <TabsList
          className="grid w-full h-auto p-1 gap-1 bg-gray-100/80"
          style={{ gridTemplateColumns: `repeat(${STATUS_FILTERS.length}, minmax(0, 1fr))` }}
          aria-label="Request status"
        >
          {STATUS_FILTERS.map((s) => (
            <TabsTrigger
              key={s}
              value={s}
              className="flex items-center justify-center gap-1.5 py-2.5 text-sm data-[state=active]:shadow-sm"
            >
              <span className="font-medium">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  statusFilter === s
                    ? 'bg-primary/15 text-primary'
                    : 'bg-gray-200/80 text-gray-600'
                }`}
              >
                {s === 'all' ? (allData?.length ?? 0) : (counts[s] ?? 0)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter} className="mt-0 pt-4 focus-visible:outline-none">
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Requester</th>
                <th className="px-4 py-3 text-left font-semibold">Application</th>
                <th className="px-4 py-3 text-left font-semibold">Resource</th>
                <th className="px-4 py-3 text-left font-semibold">Requested Role</th>
                <th className="px-4 py-3 text-left font-semibold">Justification</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="inline w-5 h-5 animate-spin mr-2" />Loading…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-red-500">
                    Failed to load requests. <button className="underline" onClick={() => refetch()}>Retry</button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <Inbox className="inline w-8 h-8 text-gray-300 mb-2 block mx-auto" />
                    <p className="text-gray-400 font-medium">No {statusFilter !== 'all' ? statusFilter : ''} requests found</p>
                  </td>
                </tr>
              ) : (
                rows.map((req) => {
                  const requesterName = [req.requester?.firstName, req.requester?.lastName].filter(Boolean).join(' ')
                    || req.requester?.email || '—';
                  const status = (req.status || 'pending').toLowerCase();
                  const isPending = status === 'pending';
                  const attrs = req.requestedAttributes ?? {};

                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      {/* Requester */}
                      <td className="px-4 py-3">
                        <p className="max-w-[180px] truncate font-medium text-gray-900" title={requesterName}>{requesterName}</p>
                        {req.requester?.email && (
                          <p className="max-w-[180px] truncate text-xs text-gray-400" title={req.requester.email}>{req.requester.email}</p>
                        )}
                      </td>

                      {/* Application */}
                      <td className="px-4 py-3 text-gray-700">
                        {req.application?.name || req.application?.key || '—'}
                      </td>

                      {/* Resource */}
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px]">
                        {req.requestedResource
                          ? (
                            <span
                              className="block truncate"
                              title={req.requestedResource.name || req.requestedResource.resourceExternalId}
                            >
                              {req.requestedResource.name || req.requestedResource.resourceExternalId}
                            </span>
                          )
                          : <span className="text-gray-400 italic">All</span>}
                      </td>

                      {/* Requested Role */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 rounded px-2 py-1">
                          {attrs.role || '—'}
                        </span>
                      </td>

                      {/* Justification */}
                      <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                        <span className="line-clamp-2 text-xs" title={attrs.justification}>
                          {attrs.justification || <span className="text-gray-400 italic">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[status] ?? STATUS_BADGE.pending}`}>
                          {STATUS_ICON[status]}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {req.reviewNotes && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[160px] truncate" title={req.reviewNotes}>
                            Note: {req.reviewNotes}
                          </p>
                        )}
                        {!isPending && req.reviewedBy && (
                          <p className="text-xs text-gray-400 mt-1">
                            By {[req.reviewedBy.firstName, req.reviewedBy.lastName].filter(Boolean).join(' ') || req.reviewedBy.email}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {fmt(req.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setModal({ request: req, action: 'approve' })}
                              className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success-soft px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success hover:text-success-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => setModal({ request: req, action: 'reject' })}
                              className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>
      </Tabs>

      {/* Review modal */}
      {modal && (
        <ReviewModal
          key={`${modal.request?.id}-${modal.initialTab ?? 'app_attributes'}`}
          request={modal.request}
          action={modal.action}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
          loading={actionLoading}
          initialTab={modal.initialTab ?? 'app_attributes'}
          preservedNotes={modal.preservedNotes ?? ''}
        />
      )}
    </div>
  );
};
