import React, { createContext, useContext } from 'react';

/**
 * Whether automatic field hints are on (packet Q1). Connected sessions provide the
 * member's server preference; every other mode falls back to off while keeping the
 * information button available.
 */
const GuidanceContext = createContext({ enabled: false });

export function GuidanceProvider({ enabled, children }) {
  return (
    <GuidanceContext.Provider value={{ enabled: enabled !== false }}>
      {children}
    </GuidanceContext.Provider>
  );
}

export const useGuidance = () => useContext(GuidanceContext);
