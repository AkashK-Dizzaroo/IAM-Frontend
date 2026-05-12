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
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved:  'bg-green-100  text-green-800  border-green-200',
  rejected:  'bg-red-100    text-red-800    border-red-200',
  cancelled: 'bg-gray-100   text-gray-600   border-gray-200',
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
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

function ReviewModal({ request, action, onConfirm, onCancel, loading, initialTab = 'app_attributes', preservedNotes = '' }) {
  const [notes, setNotes] = useState(preservedNotes);
  const [activeTab, setActiveTab] = useState(initialTab);

  const isApprove = action === 'approve';
  const appAttributes = request.pendingAppAttributes ?? null;
  const hasAppAttrs = appAttributes && Object.keys(appAttributes).length > 0;
  const hasPendingAttrs = hasAppAttrs && Object.values(appAttributes).some(m => m.status === 'PENDING_APPROVAL');
  const resourceApproved = Boolean(request.requestedAttributes?._iamApprovalProgress?.resourceApprovedAt);

  // For reject: simple single-panel layout (no tabs needed)
  if (!isApprove) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold text-red-700">Reject Access Request</h3>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="bg-gray-50 border rounded-lg p-4 space-y-2.5">
            <InfoRow label="Requester">
              <span className="font-medium">
                {[request.requester?.firstName, request.requester?.lastName].filter(Boolean).join(' ') || request.requester?.email || '—'}
              </span>
            </InfoRow>
            <InfoRow label="Application">{request.application?.name || request.application?.key || '—'}</InfoRow>
            <InfoRow label="Resource">
              {request.requestedResource
                ? (request.requestedResource.name || request.requestedResource.resourceExternalId)
                : <span className="text-gray-400 italic">Global Access</span>}
            </InfoRow>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Reason for rejection (optional)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              rows={2}
              placeholder="Reason for rejection…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={onCancel} disabled={loading}>Cancel</button>
            <button
              className="px-4 py-2 text-sm rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 flex items-center gap-2 disabled:opacity-60"
              onClick={() => onConfirm(notes, {}, null)}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Approve: two-tab layout
  const requesterName = [request.requester?.firstName, request.requester?.lastName].filter(Boolean).join(' ') || request.requester?.email || '—';
  const requestedRole = request.requestedAttributes?.role || request.requestedAttributes?.requestedRole;
  const resource = request.requestedResource;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-green-700">Approve Access Request</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {requesterName} · {request.application?.name || request.application?.key || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="app_attributes" className="flex-1">
              Application Attributes
              {hasAppAttrs && (
                <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 font-semibold">
                  {Object.keys(appAttributes).length}
                </span>
              )}
              {hasPendingAttrs && (
                <span className="ml-1 text-[10px] bg-yellow-100 text-yellow-700 rounded-full px-1.5 py-0.5 font-semibold">pending</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="resource" className="flex-1">
              Resource Details
              {resourceApproved && (
                <span className="ml-1 text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-semibold">approved</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Application Attributes ── */}
          <TabsContent value="app_attributes" className="mt-4 min-h-[160px]">
            {hasAppAttrs ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">
                  App-specific attributes submitted by the user. Approving will promote any pending ones to active.
                </p>
                <div className="bg-gray-50 border rounded-lg p-4 space-y-2.5">
                  {Object.entries(appAttributes).map(([key, meta]) => {
                    const isPending = meta.status === 'PENDING_APPROVAL';
                    const isApproved = meta.status === 'APPROVED';
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-36 text-[10px] uppercase font-semibold text-gray-500 shrink-0">
                          {meta.displayName || key}
                          <span className="ml-1 font-mono font-normal text-gray-400">({meta.dataType})</span>
                        </span>
                        <span className="flex-1 text-sm text-gray-900 font-medium">{formatAttrValue(meta.value)}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          isPending  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          isApproved ? 'bg-green-50 text-green-700 border-green-200' :
                                       'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {isPending ? 'Pending' : isApproved ? 'Approved' : meta.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {hasPendingAttrs && (
                  <>
                    <div className="space-y-1 pt-2">
                      <label className="text-sm font-medium text-gray-700">Review Notes (optional)</label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                        placeholder="Any notes for the requester…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={onCancel} disabled={loading}>Cancel</button>
                      <button
                        className="px-4 py-2 text-sm rounded-lg text-white font-medium bg-green-600 hover:bg-green-700 flex items-center gap-2 disabled:opacity-60"
                        onClick={() => onConfirm(notes, {}, 'app_attributes')}
                        disabled={loading}
                      >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        <CheckCircle className="w-4 h-4" />
                        Approve Application Request
                      </button>
                    </div>
                  </>
                )}
                {!hasPendingAttrs && (
                  <div className="pt-2" />
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No app-specific attributes for this request.</p>
                <p className="text-xs mt-1">The user did not submit any app-specific attributes.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Resource Details ── */}
          <TabsContent value="resource" className="mt-4 min-h-[160px]">
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Role and resource details from the request. Approving will sync these to the user's app attributes and mark the request as approved.
              </p>
              <div className="bg-gray-50 border rounded-lg p-4 space-y-2.5">
                <InfoRow label="Requester">
                  <span className="font-medium">{requesterName}</span>
                </InfoRow>
                <InfoRow label="Application">
                  {request.application?.name || request.application?.key || '—'}
                </InfoRow>
                <InfoRow label="Requested Role">
                  {requestedRole
                    ? <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono text-xs font-semibold">{requestedRole}</span>
                    : <span className="text-gray-400 italic">—</span>}
                </InfoRow>
                <InfoRow label="Resource">
                  {resource
                    ? <span>{resource.name || resource.resourceExternalId}{resource.level ? ` (L${resource.level})` : ''}</span>
                    : <span className="text-gray-400 italic">Global Access</span>}
                </InfoRow>
                {request.requestedAttributes?.justification && (
                  <InfoRow label="Justification">
                    <span className="text-gray-600">{request.requestedAttributes.justification}</span>
                  </InfoRow>
                )}
              </div>
              {resourceApproved ? (
                /* Resource step already done — show status, no action button */
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-700">Resource access approved</span>
                    {request.requestedAttributes?._iamApprovalProgress?.resourceApprovedAt && (
                      <span className="ml-auto text-xs text-green-500">
                        {new Date(request.requestedAttributes._iamApprovalProgress.resourceApprovedAt)
                          .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {hasPendingAttrs && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      Application attributes are still pending approval. Switch to the Application Attributes tab to complete the request.
                    </p>
                  )}
                  <div className="pt-1" />
                </div>
              ) : (
                /* Resource step pending — show notes + approve button */
                <>
                  <div className="space-y-1 pt-2">
                    <label className="text-sm font-medium text-gray-700">Review Notes (optional)</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                      placeholder="Any notes for the requester…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" onClick={onCancel} disabled={loading}>Cancel</button>
                    <button
                      className="px-4 py-2 text-sm rounded-lg text-white font-medium bg-green-600 hover:bg-green-700 flex items-center gap-2 disabled:opacity-60"
                      onClick={() => onConfirm(notes, {}, 'resource')}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <CheckCircle className="w-4 h-4" />
                      Approve Resource Request
                    </button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['access-requests', 'all', statusFilter],
    queryFn: () => accessRequestService.getAllAccessRequests({
      ...(statusFilter !== 'all' && { status: statusFilter }),
      limit: 200,
    }),
    select: (res) => {
      const rows = res?.data ?? res?.data?.data ?? [];
      return Array.isArray(rows) ? rows : [];
    },
  });

  const rows = data ?? [];

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
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
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${statusFilter === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && counts[s] != null && (
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5
                ${statusFilter === s ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {counts[s]}
              </span>
            )}
            {s === 'all' && (
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5
                ${statusFilter === s ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {rows.length > 0 ? rows.length : data?.length ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

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
                        <p className="font-medium text-gray-900">{requesterName}</p>
                        {req.requester?.email && (
                          <p className="text-xs text-gray-400">{req.requester.email}</p>
                        )}
                      </td>

                      {/* Application */}
                      <td className="px-4 py-3 text-gray-700">
                        {req.application?.name || req.application?.key || '—'}
                      </td>

                      {/* Resource */}
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {req.requestedResource
                          ? req.requestedResource.name || req.requestedResource.resourceExternalId
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs hover:bg-green-700"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => setModal({ request: req, action: 'reject' })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {req.reviewedBy
                              ? `By ${[req.reviewedBy.firstName, req.reviewedBy.lastName].filter(Boolean).join(' ') || req.reviewedBy.email}`
                              : '—'}
                          </span>
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
