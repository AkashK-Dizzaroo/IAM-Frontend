import { useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { queryClient } from "@/config/queryClient";

/**
 * Handles forced logout when Hub navigates this tab to /logout.
 * Does not depend on AuthContext so it works regardless of session state.
 */
export default function LogoutPage() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await apiClient.post("/auth/logout").catch(() => {});
      } finally {
        if (cancelled) return;
        sessionStorage.clear();
        queryClient.clear();
        window.location.replace(`${getValidHubUrl()}/login`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      <p className="text-sm font-medium">Signing out…</p>
    </div>
  );
}
