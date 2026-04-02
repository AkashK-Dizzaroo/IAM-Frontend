import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, XCircle, CheckCircle, Clock, Ban, RefreshCw, Inbox } from "lucide-react";
import { useAuth } from "@/features/auth";
import { useToast } from "@/hooks/use-toast";
import { accessRequestService } from "../api/accessRequestService";

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGE = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_ICONS = {
  PENDING: <Clock className="w-3 h-3 mr-1" />,
  APPROVED: <CheckCircle className="w-3 h-3 mr-1" />,
  REJECTED: <XCircle className="w-3 h-3 mr-1" />,
  CANCELLED: <Ban className="w-3 h-3 mr-1" />,
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const truncate = (str, max = 100) => {
  if (!str) return "—";
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

// Resolve a possibly-populated or raw-ObjectId field to a display name.
// `populated` is the top-level legacy field (already populated by getRequestsByUser).
// `fallback` is shown when the field is an unpopulated ObjectId string.
const resolveName = (populated, nameKey = "name", fallbackKey = null, fallback = "—") => {
  if (!populated) return fallback;
  if (typeof populated === "object") {
    return populated[nameKey] || (fallbackKey && populated[fallbackKey]) || fallback;
  }
  return fallback; // raw ObjectId — can't display a name
};

export const MyRequestsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("ALL");

  const userId = user?._id || user?.id;

  const {
    data: rawData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["myRequests", userId],
    queryFn: () => accessRequestService.getUserAccessRequests(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  // The service returns response.data which is the backend body: { success, data: [] }
  const allRequests = (() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (rawData?.data && Array.isArray(rawData.data)) return rawData.data;
    return [];
  })();

  const requests =
    activeFilter === "ALL"
      ? allRequests
      : allRequests.filter((r) => r.status === activeFilter);

  const { mutate: cancelRequest, isPending: isCancelPending, variables: cancellingId } =
    useMutation({
      mutationFn: (requestId) => accessRequestService.cancelAccessRequest(requestId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["myRequests", userId] });
        toast({ title: "Request cancelled", description: "Your access request has been cancelled." });
      },
      onError: (err) => {
        const message =
          err?.details?.error ||
          err?.details?.message ||
          err?.message ||
          "Failed to cancel request";
        toast({ title: "Could not cancel request", description: message, variant: "destructive" });
      },
    });

  const handleCancel = (req) => {
    if (!window.confirm("Are you sure you want to cancel this request?")) return;
    cancelRequest(req._id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Access Requests</h2>
        <p className="text-gray-600 mt-1">Track the status of access requests you have submitted</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === "ALL" ? allRequests.length : allRequests.filter((r) => r.status === f.value).length;
          const isActive = activeFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                  isActive ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-gray-600">Loading your requests…</span>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Failed to load your requests.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && requests.length === 0 && (
        <div className="text-center py-16">
          <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          {activeFilter === "ALL" ? (
            <>
              <p className="text-gray-600 font-medium">You haven&apos;t submitted any access requests yet.</p>
              <p className="text-gray-400 text-sm mt-1">
                Request access to applications from the Application Hub.
              </p>
            </>
          ) : (
            <p className="text-gray-500">No {activeFilter.toLowerCase()} requests found.</p>
          )}
        </div>
      )}

      {/* Request cards */}
      {!isLoading && !isError && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => {
            const status = req.status || "PENDING";
            const isPending = status === "PENDING";

            // Top-level fields are populated by getRequestsByUser.
            // requestedItems[i].* are raw ObjectIds from that endpoint — do not use for names.
            const appName = resolveName(req.application, "name", "appCode");
            const roleName = resolveName(req.requestedRole, "name", "roleCode");
            const resourceName = resolveName(req.requestedResource, "name", "resourceExternalId");

            const isCancelling = isCancelPending && cancellingId === req._id;

            return (
              <div
                key={req._id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-base">{appName}</span>
                      {roleName !== "—" && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {roleName}
                        </span>
                      )}
                      {resourceName !== "—" && (
                        <span className="text-xs text-gray-500 bg-blue-50 px-2 py-0.5 rounded">
                          {resourceName}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                      {truncate(req.justification)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      STATUS_BADGE[status] || "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {STATUS_ICONS[status] || null}
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                  <span>Submitted {formatDate(req.createdAt)}</span>
                  {req.reviewedAt && (
                    <span>
                      {status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Reviewed"}{" "}
                      {formatDate(req.reviewedAt)}
                    </span>
                  )}
                </div>

                {/* Reviewer comments */}
                {(status === "APPROVED" || status === "REJECTED") && req.reviewerComments && (
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <span className="font-medium text-gray-700">Reviewer note: </span>
                    {req.reviewerComments}
                  </div>
                )}

                {/* Cancel button */}
                {isPending && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCancel(req)}
                      disabled={isCancelPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCancelling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      Cancel request
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
