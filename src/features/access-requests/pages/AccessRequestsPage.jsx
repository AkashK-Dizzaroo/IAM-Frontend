import { useEffect, useMemo, useState } from "react";
import { Loader2, XCircle, CheckCircle, Clock } from "lucide-react";
import { accessRequestService } from "../api/accessRequestService";

const roleOptions = [
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
];

const formatDate = (value) => {
  if (!value) return "No expiry";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString();
};

const getStatusBadge = (status) => {
  const styles = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    APPROVED: "bg-green-100 text-green-800 border-green-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200",
    CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return styles[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusLabel = (status) => {
  const labels = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status;
};

export const AccessRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleSelections, setRoleSelections] = useState({});
  const [assignUntil, setAssignUntil] = useState({});
  const [actioning, setActioning] = useState({});

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await accessRequestService.getAllAccessRequests({
        limit: 100,
      });
      let data = [];
      if (Array.isArray(response)) data = response;
      else if (response?.data && Array.isArray(response.data)) data = response.data;
      else if (response?.success && Array.isArray(response.data)) data = response.data;

      setRequests(data);
      const defaults = {};
      const defaultDates = {};
      data.forEach((req) => {
        defaults[req._id] = "USER";
        defaultDates[req._id] = "";
      });
      setRoleSelections(defaults);
      setAssignUntil(defaultDates);
      setError("");
    } catch (err) {
      console.error("Error fetching access requests:", err);
      setError(
        err?.message ||
          err?.error ||
          err?.details?.message ||
          "Failed to load access requests"
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
    try {
      setActioning((prev) => ({ ...prev, [request._id]: "approve" }));
      const role = roleSelections[request._id] || "USER";
      const until = assignUntil[request._id];

      let assignUntilFormatted = null;
      if (until && until.trim() !== "") {
        const date = new Date(until);
        if (!isNaN(date.getTime())) {
          date.setUTCHours(23, 59, 59, 999);
          assignUntilFormatted = date.toISOString();
        }
      }

      const baseItems =
        request.requestedItems && request.requestedItems.length > 0
          ? request.requestedItems
          : [
              {
                requestedRole: request.requestedRole,
                requestedResource: request.requestedResource,
                application: request.application,
              },
            ];

      const approvals = baseItems.map(() => ({
        role,
        assignUntil: assignUntilFormatted,
      }));

      const payload = { reviewerComments: "", approvals };
      await accessRequestService.approveAccessRequest(request._id, payload);
      await fetchRequests();
    } catch (err) {
      setError(err?.message || "Failed to approve request");
    } finally {
      setActioning((prev) => ({ ...prev, [request._id]: null }));
    }
  };

  const handleReject = async (request) => {
    try {
      setActioning((prev) => ({ ...prev, [request._id]: "reject" }));
      await accessRequestService.rejectAccessRequest(request._id, "");
      await fetchRequests();
    } catch (err) {
      setError(err?.message || "Failed to reject request");
    } finally {
      setActioning((prev) => ({ ...prev, [request._id]: null }));
    }
  };

  const rows = useMemo(() => requests, [requests]);
  const statusCounts = useMemo(() => {
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    rows.forEach((req) => {
      const status = req.status || "PENDING";
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  }, [rows]);
  const totalRequests = rows.length;
  const pendingCount = statusCounts.PENDING;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Access Requests</h2>
          <p className="text-gray-600">
            Review and manage access requests from users
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {totalRequests} total ({pendingCount} pending, {statusCounts.APPROVED}{" "}
          approved, {statusCounts.REJECTED} rejected)
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Requester name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Application Requested
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Resource Requested
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Assign until
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                    Loading requests...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No requests found
                  </td>
                </tr>
              ) : (
                rows.map((req) => {
                  const apps = (req.requestedItems || [])
                    .map((i) => i.application?.name || i.application?.appCode)
                    .filter(Boolean);
                  const resources = (req.requestedItems || [])
                    .map(
                      (i) =>
                        i.requestedResource?.name ||
                        i.requestedResource?.resourceExternalId
                    )
                    .filter(Boolean);
                  const requesterName = [req.requester?.firstName, req.requester?.lastName]
                    .filter(Boolean)
                    .join(" ") || req.requester?.email || "Unknown";
                  const status = req.status || "PENDING";
                  const isPending = status === "PENDING";
                  return (
                    <tr key={req._id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {requesterName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {apps.length ? apps.join(", ") : req.application?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {resources.length
                          ? resources.join(", ")
                          : req.requestedResource?.name || "App-wide"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isPending ? (
                          <select
                            className="border rounded-md px-3 py-2 text-sm"
                            value={roleSelections[req._id] || "USER"}
                            onChange={(e) =>
                              setRoleSelections((prev) => ({
                                ...prev,
                                [req._id]: e.target.value,
                              }))
                            }
                          >
                            {roleOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-600">
                            {req.requestedItems?.[0]?.requestedRole?.roleCode ||
                              req.requestedRole?.roleCode ||
                              "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isPending ? (
                          <>
                            <input
                              type="date"
                              className="border rounded-md px-3 py-2 text-sm"
                              value={assignUntil[req._id] || ""}
                              onChange={(e) =>
                                setAssignUntil((prev) => ({
                                  ...prev,
                                  [req._id]: e.target.value,
                                }))
                              }
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              {assignUntil[req._id]
                                ? formatDate(assignUntil[req._id])
                                : "No expiry date"}
                            </div>
                          </>
                        ) : (() => {
                          let expiryDate = null;
                          if (
                            status === "APPROVED" &&
                            req.approvedItems &&
                            req.approvedItems.length > 0
                          ) {
                            expiryDate = req.approvedItems[0]?.validUntil;
                          } else if (req.expiresAt) {
                            expiryDate = req.expiresAt;
                          }
                          return expiryDate ? (
                            <span className="text-gray-700">
                              {formatDate(expiryDate)}
                            </span>
                          ) : (
                            <span className="text-gray-500">No expiry date</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                            status
                          )}`}
                        >
                          {status === "PENDING" && (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {status === "APPROVED" && (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {status === "REJECTED" && (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {getStatusLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex items-center px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                              onClick={() => handleApprove(req)}
                              disabled={!!actioning[req._id]}
                            >
                              {actioning[req._id] === "approve" ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              )}
                              Approve
                            </button>
                            <button
                              className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                              onClick={() => handleReject(req)}
                              disabled={!!actioning[req._id]}
                            >
                              {actioning[req._id] === "reject" ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4 mr-2" />
                              )}
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
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
    </div>
  );
};
