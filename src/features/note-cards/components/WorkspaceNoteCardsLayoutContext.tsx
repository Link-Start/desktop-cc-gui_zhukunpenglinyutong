import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceNoteCardsLayoutControls = {
  canMaximize: boolean;
  isMaximized: boolean;
  onToggleMaximized: () => void;
};

const WorkspaceNoteCardsLayoutContext =
  createContext<WorkspaceNoteCardsLayoutControls | null>(null);

type WorkspaceNoteCardsLayoutProviderProps = {
  children: ReactNode;
  value: WorkspaceNoteCardsLayoutControls;
};

export function WorkspaceNoteCardsLayoutProvider({
  children,
  value,
}: WorkspaceNoteCardsLayoutProviderProps) {
  return (
    <WorkspaceNoteCardsLayoutContext.Provider value={value}>
      {children}
    </WorkspaceNoteCardsLayoutContext.Provider>
  );
}

export function useWorkspaceNoteCardsLayout() {
  return useContext(WorkspaceNoteCardsLayoutContext);
}

export function useWorkspaceNoteCardsLayoutController(isActive: boolean) {
  const [isMaximized, setIsMaximized] = useState(false);
  const onToggleMaximized = useCallback(() => {
    setIsMaximized((current) => !current);
  }, []);

  useEffect(() => {
    if (!isActive) {
      setIsMaximized(false);
    }
  }, [isActive]);

  return useMemo(
    () => ({
      canMaximize: isActive,
      isMaximized: isActive && isMaximized,
      onToggleMaximized,
    }),
    [isActive, isMaximized, onToggleMaximized],
  );
}
