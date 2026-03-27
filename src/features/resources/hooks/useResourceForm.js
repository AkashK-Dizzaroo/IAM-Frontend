import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { resourceService } from "../api/resourceService";

/**
 * State machine hook for the single-page Resource Creation form.
 * Supports Level 2 and Level 3 creation. Manages hierarchy, description, validation.
 * Automatically fetches and selects Unassigned L2 when isL2Locked and creationLevel === 3.
 */
export function useResourceForm() {
  const [creationLevel, setCreationLevel] = useState(3);
  const [selectedL1Apps, setSelectedL1Apps] = useState([]);
  const [selectedL2, setSelectedL2] = useState(null);
  const [resourceName, setResourceName] = useState("");
  const [description, setDescription] = useState("");

  const isL2Locked = useMemo(
    () =>
      selectedL1Apps.length > 0 &&
      selectedL1Apps.every((app) => app.supportsLevel2 === false),
    [selectedL1Apps]
  );

  const firstAppId = selectedL1Apps[0]?._id ?? selectedL1Apps[0]?.id;
  const { data: l2ResourcesWhenLocked = [] } = useQuery({
    queryKey: ["l2-resources-locked", firstAppId],
    queryFn: async () => {
      const res = await resourceService.getResources({
        level: 2,
        applicationId: firstAppId,
        limit: 100,
        page: 1,
      });
      return res?.data ?? [];
    },
    enabled: creationLevel === 3 && isL2Locked && !!firstAppId,
  });

  useEffect(() => {
    if (
      creationLevel !== 3 ||
      !isL2Locked ||
      selectedL1Apps.length === 0 ||
      !l2ResourcesWhenLocked?.length
    ) {
      return;
    }
    const firstApp = selectedL1Apps[0];
    const appCode = firstApp?.appCode ?? "";
    const unassigned = l2ResourcesWhenLocked.find(
      (r) =>
        r.isUnassignedNode === true ||
        (r.resourceExternalId &&
          r.resourceExternalId === `HUB-UNASSIGNED-${appCode}`)
    );
    if (unassigned) {
      setSelectedL2(unassigned);
    }
  }, [creationLevel, isL2Locked, selectedL1Apps, l2ResourcesWhenLocked]);

  useEffect(() => {
    if (!isL2Locked && selectedL2) {
      const isUnassigned = selectedL2?.isUnassignedNode === true;
      if (isUnassigned) {
        setSelectedL2(null);
      }
    }
  }, [isL2Locked]);

  const setSelectedL1AppsHandler = useCallback((apps) => {
    setSelectedL1Apps(apps);
    setSelectedL2(null);
  }, []);

  const setCreationLevelHandler = useCallback((level) => {
    setCreationLevel(level);
    if (level === 2) setSelectedL2(null);
  }, []);

  const isValid = useMemo(() => {
    const hasL1 = selectedL1Apps.length > 0;
    const hasName = String(resourceName ?? "").trim().length > 0;
    if (creationLevel === 2) {
      return hasL1 && hasName;
    }
    const hasL2 = selectedL2 != null && (selectedL2._id ?? selectedL2);
    return hasL1 && !!hasL2 && hasName;
  }, [creationLevel, selectedL1Apps, selectedL2, resourceName]);

  const reset = useCallback(() => {
    setCreationLevel(3);
    setSelectedL1Apps([]);
    setSelectedL2(null);
    setResourceName("");
    setDescription("");
  }, []);

  const buildPayload = useCallback(() => {
    const meta = {};
    if (description.trim()) meta.description = description.trim();
    return {
      name: String(resourceName ?? "").trim(),
      level: creationLevel,
      parentResource:
        creationLevel === 2 ? null : (selectedL2?._id ?? selectedL2),
      assignedApplications: selectedL1Apps.map((app) => app._id ?? app.id),
      isActive: true,
      metadata: meta,
    };
  }, [creationLevel, selectedL1Apps, selectedL2, resourceName, description]);

  return {
    creationLevel,
    setCreationLevel: setCreationLevelHandler,
    selectedL1Apps,
    setSelectedL1Apps: setSelectedL1AppsHandler,
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
  };
}
