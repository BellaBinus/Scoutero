import { createContext, useContext, useState, ReactNode } from "react";

interface DevRoleContextValue {
  simulateRegularUser: boolean;
  setSimulateRegularUser: (v: boolean) => void;
}

const DevRoleContext = createContext<DevRoleContextValue>({
  simulateRegularUser: false,
  setSimulateRegularUser: () => {},
});

export function DevRoleProvider({ children }: { children: ReactNode }) {
  const [simulateRegularUser, setSimulateRegularUser] = useState(false);
  return (
    <DevRoleContext.Provider value={{ simulateRegularUser, setSimulateRegularUser }}>
      {children}
    </DevRoleContext.Provider>
  );
}

export function useDevRole() {
  return useContext(DevRoleContext);
}
