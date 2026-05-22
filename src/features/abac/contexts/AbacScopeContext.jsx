import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const AbacScopeContext = createContext(null);

const STORAGE_KEY = 'abac.scope';

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, name, id = null) {
  try {
    if (key) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, name, id }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage may be unavailable in some environments — fail silently
  }
}

// Single state atom instead of 4 independent useState calls.
// Eliminates 3 extra re-renders per selectApp/selectGlobal call.
function buildState(saved) {
  if (saved?.key) {
    return { scope: 'app', selectedAppKey: saved.key, selectedAppName: saved.name ?? null, selectedAppId: saved.id ?? null };
  }
  return { scope: 'global', selectedAppKey: null, selectedAppName: null, selectedAppId: null };
}

export function AbacScopeProvider({ children }) {
  const [state, setState] = useState(() => buildState(readStorage()));

  const selectApp = useCallback((key, name, id = null) => {
    setState({ scope: 'app', selectedAppKey: key, selectedAppName: name, selectedAppId: id });
    writeStorage(key, name, id);
  }, []);

  const selectGlobal = useCallback(() => {
    setState({ scope: 'global', selectedAppKey: null, selectedAppName: null, selectedAppId: null });
    writeStorage(null, null, null);
  }, []);

  // Stable object reference: only changes when the actual state values change.
  const contextValue = useMemo(() => ({
    scope: state.scope,
    selectedAppKey: state.selectedAppKey,
    selectedAppName: state.selectedAppName,
    selectedAppId: state.selectedAppId,
    selectApp,
    selectGlobal,
  }), [state, selectApp, selectGlobal]);

  return (
    <AbacScopeContext.Provider value={contextValue}>
      {children}
    </AbacScopeContext.Provider>
  );
}

export const useAbacScope = () => {
  const ctx = useContext(AbacScopeContext);
  if (!ctx) throw new Error(
    'useAbacScope must be used inside AbacScopeProvider'
  );
  return ctx;
};
