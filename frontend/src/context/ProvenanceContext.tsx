import React, { createContext, useContext, useState } from 'react';

interface ProvenanceContextType {
  provenanceEnabled: boolean;
  toggleProvenance: () => void;
  setProvenanceEnabled: (enabled: boolean) => void;
}

const ProvenanceContext = createContext<ProvenanceContextType | undefined>(undefined);

export const ProvenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provenanceEnabled, setProvenanceEnabled] = useState<boolean>(true);

  const toggleProvenance = () => {
    setProvenanceEnabled((prev) => !prev);
  };

  return (
    <ProvenanceContext.Provider value={{ provenanceEnabled, toggleProvenance, setProvenanceEnabled }}>
      {children}
    </ProvenanceContext.Provider>
  );
};

export const useProvenance = (): ProvenanceContextType => {
  const context = useContext(ProvenanceContext);
  if (!context) {
    return {
      provenanceEnabled: true,
      toggleProvenance: () => {},
      setProvenanceEnabled: () => {}
    };
  }
  return context;
};
