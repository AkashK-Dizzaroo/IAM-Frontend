import { ResourceManagementTab } from "../components/ResourceManagementTab";

export function ResourceManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Resources</h2>
        <p className="text-gray-600">
          Manage application resources
        </p>
      </div>
      <ResourceManagementTab />
    </div>
  );
}
