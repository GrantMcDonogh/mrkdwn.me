import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { Id } from "../../convex/_generated/dataModel";

// --- Types ---

interface Tab {
  id: string;
  noteId: Id<"notes">;
}

interface Pane {
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

export interface WorkspaceState {
  vaultId: Id<"vaults"> | null;
  panes: Pane[];
  activePaneId: string;
  splitDirection: "horizontal" | "vertical" | null;
  sidebarOpen: boolean;
  rightPanel: "backlinks" | "graph" | "search" | "chat" | null;
  searchQuery: string;
}

export type Action =
  | { type: "SET_VAULT"; vaultId: Id<"vaults"> }
  | { type: "LEAVE_VAULT" }
  | { type: "OPEN_NOTE"; noteId: Id<"notes"> }
  | { type: "CLOSE_TAB"; paneId: string; tabId: string }
  | { type: "SET_ACTIVE_TAB"; paneId: string; tabId: string }
  | { type: "SET_ACTIVE_PANE"; paneId: string }
  | { type: "SPLIT_PANE"; direction: "horizontal" | "vertical" }
  | { type: "CLOSE_PANE"; paneId: string }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_RIGHT_PANEL"; panel: WorkspaceState["rightPanel"] }
  | { type: "SET_SEARCH_QUERY"; query: string };

// --- Initial state ---

const defaultPane: Pane = { id: "pane-1", tabs: [], activeTabId: null };

export const initialState: WorkspaceState = {
  vaultId: null,
  panes: [defaultPane],
  activePaneId: "pane-1",
  splitDirection: null,
  sidebarOpen: true,
  rightPanel: null,
  searchQuery: "",
};

// --- Reducer ---

let tabCounter = 0;

export function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "SET_VAULT":
      return {
        ...initialState,
        vaultId: action.vaultId,
        panes: [{ id: "pane-1", tabs: [], activeTabId: null }],
        activePaneId: "pane-1",
      };

    case "LEAVE_VAULT":
      return {
        ...initialState,
        panes: [{ id: "pane-1", tabs: [], activeTabId: null }],
        activePaneId: "pane-1",
      };

    case "OPEN_NOTE": {
      const paneIdx = state.panes.findIndex(
        (p) => p.id === state.activePaneId
      );
      if (paneIdx === -1) return state;
      const pane = state.panes[paneIdx]!;
      const existingTab = pane.tabs.find((t) => t.noteId === action.noteId);
      if (existingTab) {
        const updatedPane = { ...pane, activeTabId: existingTab.id };
        const panes = [...state.panes];
        panes[paneIdx] = updatedPane;
        return { ...state, panes };
      }
      const newTab: Tab = {
        id: `tab-${++tabCounter}`,
        noteId: action.noteId,
      };
      const updatedPane = {
        ...pane,
        tabs: [...pane.tabs, newTab],
        activeTabId: newTab.id,
      };
      const panes = [...state.panes];
      panes[paneIdx] = updatedPane;
      return { ...state, panes };
    }

    case "CLOSE_TAB": {
      const paneIdx = state.panes.findIndex((p) => p.id === action.paneId);
      if (paneIdx === -1) return state;
      const pane = state.panes[paneIdx]!;
      const tabIdx = pane.tabs.findIndex((t) => t.id === action.tabId);
      if (tabIdx === -1) return state;
      const newTabs = pane.tabs.filter((t) => t.id !== action.tabId);
      let newActiveTabId = pane.activeTabId;
      if (pane.activeTabId === action.tabId) {
        const prev = newTabs[tabIdx - 1] ?? newTabs[0];
        newActiveTabId = prev?.id ?? null;
      }
      const panes = [...state.panes];
      panes[paneIdx] = { ...pane, tabs: newTabs, activeTabId: newActiveTabId };
      return { ...state, panes };
    }

    case "SET_ACTIVE_TAB": {
      const paneIdx = state.panes.findIndex((p) => p.id === action.paneId);
      if (paneIdx === -1) return state;
      const panes = [...state.panes];
      panes[paneIdx] = { ...panes[paneIdx]!, activeTabId: action.tabId };
      return { ...state, panes };
    }

    case "SET_ACTIVE_PANE":
      return { ...state, activePaneId: action.paneId };

    case "SPLIT_PANE": {
      if (state.panes.length >= 2) return state;
      const newPane: Pane = {
        id: "pane-2",
        tabs: [],
        activeTabId: null,
      };
      return {
        ...state,
        panes: [...state.panes, newPane],
        splitDirection: action.direction,
      };
    }

    case "CLOSE_PANE": {
      if (state.panes.length <= 1) return state;
      const remaining = state.panes.filter((p) => p.id !== action.paneId);
      return {
        ...state,
        panes: remaining,
        activePaneId: remaining[0]!.id,
        splitDirection: null,
      };
    }

    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case "SET_RIGHT_PANEL":
      return {
        ...state,
        rightPanel:
          state.rightPanel === action.panel ? null : action.panel,
      };

    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };

    default:
      return state;
  }
}

// --- Context ---

const WorkspaceContext = createContext<
  [WorkspaceState, Dispatch<Action>] | null
>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useReducer(reducer, initialState);
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
