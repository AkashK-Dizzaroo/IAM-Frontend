import { useEffect, useState } from "react";
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
} from "lucide-react";
import { userService } from "../api/userService";
import { useToast } from "@/hooks/use-toast";
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

/** API returns PostgreSQL `id`; legacy UIs used Mongo-style `_id`. */
function userRowId(request) {
  return request?.id ?? request?._id;
}

export const AccountRequestsPage = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioning, setActioning] = useState({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers({
        status: "PENDING_APPROVAL",
        limit: 100,
      });
      if (response.success) setRequests(response.data || []);
      setError("");
    } catch (err) {
      console.error("Error fetching account requests:", err);
      setError(
        err?.message || err?.error || "Failed to load account requests"
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (request) => {
    const uid = userRowId(request);
    if (!uid) {
      toast({
        title: "Error",
        description: "Missing user id — cannot approve.",
        variant: "destructive",
      });
      return;
    }
    try {
      setActioning((prev) => ({ ...prev, [uid]: "approve" }));
      const res = await userService.approveUserAccount(uid);
      if (!res?.success) {
        throw new Error(res?.error || "Approval failed");
      }
      toast({
        title: "Success",
        description: `Account for ${request.firstName} ${request.lastName} has been approved.`,
      });
      await fetchRequests();
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Failed to approve account",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: "Missing user id — cannot reject.",
        variant: "destructive",
      });
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
      await fetchRequests();
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message || "Failed to reject account",
        variant: "destructive",
      });
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account Approvals</h2>
          <p className="text-gray-600">
            Review and action new user registration requests
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
            {requests.length} Pending
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                    Loading requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <CheckCircle className="w-12 h-12 mb-2 text-green-500" />
                      <p className="text-sm font-medium">
                        No pending account requests
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        All registration requests have been processed
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={userRowId(request) || request.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
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
                      <div className="text-sm text-gray-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formatDate(request.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          onClick={() => handleApprove(request)}
                          disabled={!!actioning[userRowId(request)]}
                        >
                          {actioning[userRowId(request)] === "approve" ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          onClick={() => handleRejectClick(request)}
                          disabled={!!actioning[userRowId(request)]}
                        >
                          {actioning[userRowId(request)] === "reject" ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Account Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the account request for{" "}
              <strong>
                {selectedRequest?.firstName} {selectedRequest?.lastName}
              </strong>
              ? Please provide a reason for rejection.
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
