import { useState } from "react";
import {
  Loader2,
  XCircle,
  CheckCircle,
  Clock,
  User,
  Mail,
  Building,
  MapPin,
  Calendar,
  Inbox,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../api/userService";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const QUERY_KEY = ["account-approvals"];

const STATUS_FILTERS = ["all", "pending", "approved", "rejected"];

const STATUS_BADGE = {
  pending: "bg-warning-soft text-warning border-warning/30",
  approved: "bg-success-soft text-success border-success/25",
  rejected: "bg-destructive-soft text-destructive border-destructive/25",
};

const STATUS_ICON = {
  pending: <Clock className="w-3 h-3 mr-1" />,
  approved: <CheckCircle className="w-3 h-3 mr-1" />,
  rejected: <XCircle className="w-3 h-3 mr-1" />,
};

/** API returns PostgreSQL `id`; legacy UIs used Mongo-style `_id`. */
function userRowId(request) {
  return request?.id ?? request?._id;
}

export const AccountRequestsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actioning, setActioning] = useState({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Approved registrations are active users with metadata.approvedAt;
  // rejected ones are soft-deleted users with metadata.rejectedAt. Those
  // markers distinguish registration outcomes from admin-created/deleted users.
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const [pending, active, deleted] = await Promise.all([
        userService.getUsers({ status: "pending", limit: 100 }),
        userService.getUsers({ status: "active", limit: 100 }),
        userService.getUsers({ status: "deleted", limit: 100 }),
      ]);
      return {
        pending: pending?.data ?? [],
        active: active?.data ?? [],
        deleted: deleted?.data ?? [],
      };
    },
    staleTime: 30_000,
  });

  const byProcessedAtDesc = (key) => (a, b) =>
    new Date(b.metadata?.[key] ?? 0) - new Date(a.metadata?.[key] ?? 0);

  const pendingRows = (data?.pending ?? []).map((u) => ({ ...u, accountStatus: "pending" }));
  const approvedRows = (data?.active ?? [])
    .filter((u) => u.metadata?.approvedAt)
    .sort(byProcessedAtDesc("approvedAt"))
    .map((u) => ({ ...u, accountStatus: "approved" }));
  const rejectedRows = (data?.deleted ?? [])
    .filter((u) => u.metadata?.rejectedAt)
    .sort(byProcessedAtDesc("rejectedAt"))
    .map((u) => ({ ...u, accountStatus: "rejected" }));

  const allRows = [...pendingRows, ...approvedRows, ...rejectedRows];
  const counts = {
    all: allRows.length,
    pending: pendingRows.length,
    approved: approvedRows.length,
    rejected: rejectedRows.length,
  };
  const rows =
    statusFilter === "pending" ? pendingRows :
    statusFilter === "approved" ? approvedRows :
    statusFilter === "rejected" ? rejectedRows :
    allRows;

  const refetchRequests = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const handleApprove = async (request) => {
    const uid = userRowId(request);
    if (!uid) {
      toast({ title: "Error", description: "Missing user id — cannot approve.", variant: "destructive" });
      return;
    }
    try {
      setActioning((prev) => ({ ...prev, [uid]: "approve" }));
      const res = await userService.approveUserAccount(uid);
      if (!res?.success) throw new Error(res?.error || "Approval failed");
      toast({
        title: "Success",
        description: `Account for ${request.firstName} ${request.lastName} has been approved.`,
      });
      await refetchRequests();
    } catch (err) {
      toast({ title: "Error", description: err?.message || "Failed to approve account", variant: "destructive" });
    } finally {
      setActioning((prev) => ({ ...prev, [uid]: null }));
    }
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;
    const uid = userRowId(selectedRequest);
    if (!uid) {
      toast({ title: "Error", description: "Missing user id — cannot reject.", variant: "destructive" });
      return;
    }
    try {
      setActioning((prev) => ({ ...prev, [uid]: "reject" }));
      await userService.rejectUserAccount(uid, rejectionReason);
      toast({
        title: "Success",
        description: `Account for ${selectedRequest.firstName} ${selectedRequest.lastName} has been rejected.`,
      });
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason("");
      await refetchRequests();
    } catch (err) {
      toast({ title: "Error", description: err?.message || "Failed to reject account", variant: "destructive" });
    } finally {
      setActioning((prev) => ({ ...prev, [uid]: null }));
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account Approvals</h2>
          <p className="text-gray-600">
            Review and action new user registration requests
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-soft border border-destructive/25 text-destructive px-4 py-3">
          {error?.message || "Failed to load account requests"}
        </div>
      )}

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
                    ? "bg-primary/15 text-primary"
                    : "bg-gray-200/80 text-gray-600"
                }`}
              >
                {counts[s] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter} className="mt-0 pt-4 focus-visible:outline-none">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Requested Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                        Loading requests...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          {statusFilter === "pending" ? (
                            <CheckCircle className="w-12 h-12 mb-2 text-success" />
                          ) : (
                            <Inbox className="w-12 h-12 mb-2 text-gray-300" />
                          )}
                          <p className="text-sm font-medium">
                            No {statusFilter !== "all" ? statusFilter : ""} account requests
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {statusFilter === "pending"
                              ? "All registration requests have been processed"
                              : "Nothing to show for this filter yet"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((request) => {
                      const status = request.accountStatus;
                      const isPending = status === "pending";
                      const processedAt =
                        status === "approved" ? request.metadata?.approvedAt :
                        status === "rejected" ? request.metadata?.rejectedAt :
                        null;
                      return (
                        <tr key={userRowId(request) || request.email} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-accent-teal to-primary flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {request.firstName?.[0]}
                                  {request.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  <User className="w-3 h-3 text-gray-400" />
                                  {request.firstName} {request.lastName}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Mail className="w-3 h-3" />
                                  {request.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 flex items-center gap-1">
                              {request.organization ? (
                                <>
                                  <Building className="w-3 h-3 text-gray-400" />
                                  {request.organization}
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 flex items-start gap-1 max-w-xs">
                              {request.address ? (
                                <>
                                  <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-2">{request.address}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 flex items-center gap-1 whitespace-nowrap">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {formatDate(request.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[status]}`}>
                              {STATUS_ICON[status]}
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                            {processedAt && (
                              <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">
                                {formatDate(processedAt)}
                              </p>
                            )}
                            {status === "rejected" && request.metadata?.rejectionReason && (
                              <p
                                className="text-xs text-gray-400 mt-1 max-w-[160px] truncate"
                                title={request.metadata.rejectionReason}
                              >
                                Note: {request.metadata.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isPending ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success-soft px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success hover:text-success-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
                                  onClick={() => handleApprove(request)}
                                  disabled={!!actioning[userRowId(request)]}
                                >
                                  {actioning[userRowId(request)] === "approve" ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-3 w-3" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
                                  onClick={() => handleRejectClick(request)}
                                  disabled={!!actioning[userRowId(request)]}
                                >
                                  {actioning[userRowId(request)] === "reject" ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
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

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Account Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the account request for{" "}
              <strong>
                {selectedRequest?.firstName} {selectedRequest?.lastName}
              </strong>? Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setSelectedRequest(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!!actioning[userRowId(selectedRequest)]}
            >
              {actioning[userRowId(selectedRequest)] === "reject" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
