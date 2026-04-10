import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, CheckCircle, XCircle, Clock, Ban, RefreshCw, Inbox,
} from 'lucide-react';
import { accessRequestService } from '../api/accessRequestService';
import { useToast } from '@/hooks/use-toast';

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

// ── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({ request, action, onConfirm, onCancel, loading }) {
  const [notes, setNotes] = useState('');
  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h3 className={`text-lg font-semibold ${isApprove ? 'text-green-700' : 'text-red-700'}`}>
          {isApprove ? 'Approve Access Request' : 'Reject Access Request'}
        </h3>

        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Requester:</span> {[request.requester?.firstName, request.requester?.lastName].filter(Boolean).join(' ') || request.requester?.email || '—'}</p>
          <p><span className="font-medium">Application:</span> {request.application?.name || request.application?.appCode || '—'}</p>
          <p><span className="font-medium">Requested Role:</span> <span className="font-mono">{request.requestedAttributes?.role || '—'}</span></p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Review Notes (optional)</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder={isApprove ? 'Any notes for the requester…' : 'Reason for rejection…'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium flex items-center gap-2 disabled:opacity-60
              ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            onClick={() => onConfirm(notes)}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isApprove ? 'Approve' : 'Reject'}
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
    mutationFn: ({ id, notes }) => accessRequestService.approveAccessRequest(id, notes),
    onSuccess: () => {
      toast({ title: 'Request approved' });
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      setModal(null);
    },
    onError: (err) => toast({ title: 'Approve failed', description: err?.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => accessRequestService.rejectAccessRequest(id, notes),
    onSuccess: () => {
      toast({ title: 'Request rejected' });
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      setModal(null);
    },
    onError: (err) => toast({ title: 'Reject failed', description: err?.message, variant: 'destructive' }),
  });

  const actionLoading = approveMutation.isPending || rejectMutation.isPending;

  const handleConfirm = (notes) => {
    if (!modal) return;
    const { request, action } = modal;
    if (action === 'approve') {
      approveMutation.mutate({ id: request.id, notes });
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
                        {req.application?.name || req.application?.appCode || '—'}
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
          request={modal.request}
          action={modal.action}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};
