import { useAbacScope } from "@/features/abac/contexts/AbacScopeContext";
import { useQuery } from "@tanstack/react-query";
import { applicationService } from "@/features/applications";
import { AppResourcesTab } from "../components/AppResourcesTab";
import { AppWindow } from "lucide-react";

export function AppResourcesPage() {
  const { scope, selectedAppId, selectedAppName, selectedAppKey } = useAbacScope();
  const isAppScope = scope === "app" && !!selectedAppId;

  const { data: appData } = useQuery({
    queryKey: ["application-detail", selectedAppId],
    queryFn: () => applicationService.getApplicationById(selectedAppId),
    enabled: isAppScope,
    staleTime: 5 * 60_000,
  });

  const application = appData?.data ?? appData ?? null;

  if (!isAppScope) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <AppWindow className="w-6 h-6 text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-700 mb-1">No Application Selected</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Select an application from the sidebar to manage its resources.
        </p>
      </div>
    );
  }

  // While loading the full application object, use a minimal object from scope context
  const effectiveApp = application ?? { id: selectedAppId, _id: selectedAppId, name: selectedAppName, appCode: selectedAppKey };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">App Resources</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resources linked to <span className="font-medium text-gray-700">{selectedAppName}</span>.
          Changes to resource details are saved globally.
        </p>
      </div>

      <AppResourcesTab application={effectiveApp} />
    </div>
  );
}
