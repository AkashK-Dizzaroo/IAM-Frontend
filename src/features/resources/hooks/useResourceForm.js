import { useState, useCallback, useMemo } from "react";
import { APP_LEVEL_TYPES } from "../config/resourceTypeConfig";

export function appSupportsL2(app) {
  const code = (app?.key ?? "").toUpperCase();
  const config = APP_LEVEL_TYPES[code];
  if (config) {
    return Array.isArray(config[2]) && config[2].length > 0;
  }
  return app?.supportsLevel2 === true;
}

export function useResourceForm() {
  const [l1Apps, setL1Apps] = useState([]);
  const [levelRaw, setLevelRaw] = useState(3);
  const [selectedL2, setSelectedL2] = useState(null);
  const [resourceName, setResourceName] = useState("");
  const [description, setDescription] = useState("");

  const isL2Locked = useMemo(
    () => l1Apps.length > 0 && l1Apps.every((app) => !appSupportsL2(app)),
    [l1Apps]
  );

  // Derive effective level — locked apps can only create L3.
  const creationLevel = isL2Locked ? 3 : levelRaw;

  const setCreationLevel = useCallback((level) => {
    setLevelRaw(level);
    if (level === 2) setSelectedL2(null);
  }, []);

  const setSelectedL1Apps = useCallback((apps) => {
    setL1Apps(apps);
    setSelectedL2(null);
  }, []);

  // Sets app + correct starting level in one synchronous call — no effect lag.
  const initForApp = useCallback((app) => {
    setL1Apps([app]);
    setSelectedL2(null);
    setLevelRaw(appSupportsL2(app) ? 2 : 3);
  }, []);

  const isValid = useMemo(() => {
    const hasL1 = l1Apps.length > 0;
    const hasName = String(resourceName ?? "").trim().length > 0;
    if (creationLevel === 2) return hasL1 && hasName;
    if (isL2Locked) return hasL1 && hasName;
    const hasL2 = selectedL2 != null && !!(selectedL2._id ?? selectedL2.id);
    return hasL1 && hasL2 && hasName;
  }, [creationLevel, l1Apps, selectedL2, resourceName, isL2Locked]);

  const reset = useCallback(() => {
    setL1Apps([]);
    setLevelRaw(3);
    setSelectedL2(null);
    setResourceName("");
    setDescription("");
  }, []);

  const buildPayload = useCallback(() => {
    const meta = {};
    if (description.trim()) meta.description = description.trim();
    const parentResource =
      creationLevel === 3 && !isL2Locked
        ? (selectedL2?._id ?? selectedL2?.id ?? null)
        : null;
    return {
      name: String(resourceName ?? "").trim(),
      level: creationLevel,
      parentResource,
      assignedApplications: l1Apps.map((app) => app._id ?? app.id),
      metadata: { resource_status: 'active', ...meta },
    };
  }, [creationLevel, l1Apps, selectedL2, resourceName, description, isL2Locked]);

  return {
    creationLevel,
    setCreationLevel,
    selectedL1Apps: l1Apps,
    setSelectedL1Apps,
    selectedL2,
    setSelectedL2,
    resourceName,
    setResourceName,
    description,
    setDescription,
    isL2Locked,
    isValid,
    reset,
    buildPayload,
    initForApp,
  };
}
