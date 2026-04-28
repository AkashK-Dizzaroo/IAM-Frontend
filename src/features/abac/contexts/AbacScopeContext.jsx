import { createContext, useContext, useState } from 'react';

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

export function AbacScopeProvider({ children }) {
  const saved = readStorage();

  const [scope, setScope] = useState(saved ? 'app' : 'global');
  const [selectedAppKey, setSelectedAppKey] = useState(saved?.key ?? null);
  const [selectedAppName, setSelectedAppName] = useState(saved?.name ?? null);
  const [selectedAppId, setSelectedAppId] = useState(saved?.id ?? null);

  const selectApp = (key, name, id = null) => {
    setSelectedAppKey(key);
    setSelectedAppName(name);
    setSelectedAppId(id);
    setScope('app');
    writeStorage(key, name, id);
  };

  const selectGlobal = () => {
    setScope('global');
    setSelectedAppKey(null);
    setSelectedAppName(null);
    setSelectedAppId(null);
    writeStorage(null, null, null);
  };

  return (
    <AbacScopeContext.Provider value={{
      scope,
      selectedAppKey,
      selectedAppName,
      selectedAppId,
      selectApp,
      selectGlobal,
    }}>
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
