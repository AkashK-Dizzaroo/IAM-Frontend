import React, { createContext, useContext, useState } from 'react';

const AbacScopeContext = createContext(null);

export function AbacScopeProvider({ children }) {
  const [scope, setScope] = useState('global');
  const [selectedAppKey, setSelectedAppKey] = useState(null);
  const [selectedAppName, setSelectedAppName] = useState(null);

  const selectApp = (key, name) => {
    setSelectedAppKey(key);
    setSelectedAppName(name);
    setScope('app');
  };

  const selectGlobal = () => {
    setScope('global');
    setSelectedAppKey(null);
    setSelectedAppName(null);
  };

  return (
    <AbacScopeContext.Provider value={{
      scope,
      selectedAppKey,
      selectedAppName,
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
