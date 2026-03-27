/**
 * App topology: Level 1 = Application, Level 2 = Project/Unassigned, Level 3 = Study/Unassigned.
 * null at a level = Unassigned (ghost node / not natively supported).
 */
export const APP_LEVEL_TYPES = {
  // Document Writer: Application | Project | Study
  DOCUMENT_AUTHORING_TOOL: { 1: ["Application"], 2: ["Project"], 3: ["Study"] },
  // Data Review: Application | Unassigned | Study
  DATA_REVIEW_TOOL: { 1: ["Application"], 2: null, 3: ["Study"] },
  // RAG: Application | Unassigned | Unassigned
  RAG_INTELLIGENCE: { 1: ["Application"], 2: null, 3: null },
  // Study Operation: Application | Unassigned | Study
  STUDY_OPERATIONS: { 1: ["Application"], 2: null, 3: ["Study"] },
  // CDM Startup: Application | Project | Study
  CDM_STARTUP: { 1: ["Application"], 2: ["Project"], 3: ["Study"] },
  // Etmf/NeuroDoc: Application | Project | Study
  NEURODOC: { 1: ["Application"], 2: ["Project"], 3: ["Study"] },
  // Translational Biology: Application | Project | Unassigned
  TRANSLATIONAL_BIOLOGY: { 1: ["Application"], 2: ["Project"], 3: null },
  // SDTM: Application | Unassigned | Study
  SDTM_CONVERSION: { 1: ["Application"], 2: null, 3: ["Study"] },
  // Coming-soon (default: no L2/L3)
  CRM_HUB: { 1: ["Application"], 2: null, 3: null },
  LLM_SANDBOX: { 1: ["Application"], 2: null, 3: null },
  NDA_PACKAGE: { 1: ["Application"], 2: null, 3: null },
  PHARMACOVIGILANCE: { 1: ["Application"], 2: null, 3: null },
  KNOWLEDGE_GRAPH: { 1: ["Application"], 2: null, 3: null },
};

const DEFAULT_TYPES = ["Application", "Project", "Study", "Site"];

export function getTypesForApplicationAndLevel(appCode, level) {
  if (!appCode || !level) return DEFAULT_TYPES;
  const upper = String(appCode).toUpperCase();
  const config = APP_LEVEL_TYPES[upper];
  if (!config) return DEFAULT_TYPES;
  const types = config[level];
  if (!types || types.length === 0) return DEFAULT_TYPES;
  return types;
}

export function levelHasTypes(appCode, level) {
  const types = getTypesForApplicationAndLevel(appCode, level);
  return types && types.length > 0;
}

/**
 * Given an appCode and a child resource type, determine the required parent type
 * based on APP_LEVEL_TYPES. Finds the level where the child type lives, then
 * returns the first type from the nearest lower level that has configured types.
 */
/**
 * Map resource type to Hub level. Level 2 (Project/Site), Level 3 (Study).
 */
export function getLevelForType(type) {
  if (!type) return 2;
  const t = String(type).toLowerCase();
  if (t === "study") return 3;
  if (t === "project" || t === "site") return 2;
  return 2;
}

export function getParentTypeFor(appCode, childType) {
  if (!appCode || !childType) return null;

  const upper = String(appCode).toUpperCase();
  const config = APP_LEVEL_TYPES[upper];
  if (!config) return null;

  let childLevel = null;
  for (const [levelKey, types] of Object.entries(config)) {
    if (Array.isArray(types) && types.includes(childType)) {
      childLevel = parseInt(levelKey, 10);
      break;
    }
  }

  if (!childLevel || childLevel <= 1) return null;

  for (let level = childLevel - 1; level >= 1; level -= 1) {
    const types = config[level];
    if (Array.isArray(types) && types.length > 0) {
      return types[0];
    }
  }

  return null;
}
