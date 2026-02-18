import { describe, it, expect } from "vitest";
import { reducer, initialState, type Action } from "./workspace";
import type { WorkspaceState } from "./workspace";
import type { Id } from "../../convex/_generated/dataModel";

// Helpers
const vaultId = "vault1" as Id<"vaults">;
const noteA = "noteA" as Id<"notes">;
const noteB = "noteB" as Id<"notes">;
const noteC = "noteC" as Id<"notes">;

function apply(actions: Action[], state: WorkspaceState = initialState) {
  return actions.reduce(reducer, state);
}

// ---------- SET_VAULT / LEAVE_VAULT ----------

describe("SET_VAULT", () => {
  it("sets the vault id and resets panes", () => {
    const s = reducer(initialState, { type: "SET_VAULT", vaultId });
    expect(s.vaultId).toBe(vaultId);
    expect(s.panes).toHaveLength(1);
    expect(s.panes[0]!.tabs).toEqual([]);
  });
});

describe("LEAVE_VAULT", () => {
  it("resets to initial state", () => {
    const withVault = reducer(initialState, { type: "SET_VAULT", vaultId });
    const s = reducer(withVault, { type: "LEAVE_VAULT" });
    expect(s.vaultId).toBeNull();
    expect(s.panes).toHaveLength(1);
  });
});

// ---------- OPEN_NOTE ----------

describe("OPEN_NOTE", () => {
  it("creates a new tab in the active pane", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
    ]);
    const pane = s.panes[0]!;
    expect(pane.tabs).toHaveLength(1);
    expect(pane.tabs[0]!.noteId).toBe(noteA);
    expect(pane.activeTabId).toBe(pane.tabs[0]!.id);
  });

  it("reactivates an existing tab instead of duplicating", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_NOTE", noteId: noteB },
      { type: "OPEN_NOTE", noteId: noteA }, // re-open A
    ]);
    const pane = s.panes[0]!;
    expect(pane.tabs).toHaveLength(2); // still just A and B
    expect(pane.activeTabId).toBe(pane.tabs[0]!.id); // A is active again
  });

  it("opens multiple different notes as separate tabs", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_NOTE", noteId: noteB },
      { type: "OPEN_NOTE", noteId: noteC },
    ]);
    expect(s.panes[0]!.tabs).toHaveLength(3);
  });
});

// ---------- CLOSE_TAB ----------

describe("CLOSE_TAB", () => {
  it("removes the tab and activates the previous one", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_NOTE", noteId: noteB },
    ]);
    const pane = s.panes[0]!;
    const tabB = pane.tabs[1]!;
    const closed = reducer(s, {
      type: "CLOSE_TAB",
      paneId: pane.id,
      tabId: tabB.id,
    });
    expect(closed.panes[0]!.tabs).toHaveLength(1);
    expect(closed.panes[0]!.activeTabId).toBe(pane.tabs[0]!.id);
  });

  it("closes a non-active tab without changing active", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_NOTE", noteId: noteB },
    ]);
    const pane = s.panes[0]!;
    const tabA = pane.tabs[0]!;
    // B is currently active; close A
    const closed = reducer(s, {
      type: "CLOSE_TAB",
      paneId: pane.id,
      tabId: tabA.id,
    });
    expect(closed.panes[0]!.tabs).toHaveLength(1);
    // active stays on B
    expect(closed.panes[0]!.activeTabId).toBe(pane.tabs[1]!.id);
  });

  it("sets activeTabId to null when last tab is closed", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
    ]);
    const pane = s.panes[0]!;
    const closed = reducer(s, {
      type: "CLOSE_TAB",
      paneId: pane.id,
      tabId: pane.tabs[0]!.id,
    });
    expect(closed.panes[0]!.tabs).toHaveLength(0);
    expect(closed.panes[0]!.activeTabId).toBeNull();
  });
});

// ---------- SET_ACTIVE_TAB ----------

describe("SET_ACTIVE_TAB", () => {
  it("switches the active tab within a pane", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_NOTE", noteId: noteB },
    ]);
    const pane = s.panes[0]!;
    const tabA = pane.tabs[0]!;
    const switched = reducer(s, {
      type: "SET_ACTIVE_TAB",
      paneId: pane.id,
      tabId: tabA.id,
    });
    expect(switched.panes[0]!.activeTabId).toBe(tabA.id);
  });
});

// ---------- SET_ACTIVE_PANE ----------

describe("SET_ACTIVE_PANE", () => {
  it("changes the active pane id", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "SPLIT_PANE", direction: "horizontal" },
      { type: "SET_ACTIVE_PANE", paneId: "pane-2" },
    ]);
    expect(s.activePaneId).toBe("pane-2");
  });
});

// ---------- SPLIT_PANE ----------

describe("SPLIT_PANE", () => {
  it("adds a second pane with the given direction", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "SPLIT_PANE", direction: "vertical" },
    ]);
    expect(s.panes).toHaveLength(2);
    expect(s.splitDirection).toBe("vertical");
    expect(s.panes[1]!.id).toBe("pane-2");
  });

  it("is a no-op when already split", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "SPLIT_PANE", direction: "horizontal" },
      { type: "SPLIT_PANE", direction: "vertical" }, // should be ignored
    ]);
    expect(s.panes).toHaveLength(2);
    expect(s.splitDirection).toBe("horizontal"); // unchanged
  });
});

// ---------- CLOSE_PANE ----------

describe("CLOSE_PANE", () => {
  it("removes the pane and reverts to single-pane layout", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "SPLIT_PANE", direction: "horizontal" },
      { type: "CLOSE_PANE", paneId: "pane-2" },
    ]);
    expect(s.panes).toHaveLength(1);
    expect(s.splitDirection).toBeNull();
    expect(s.activePaneId).toBe("pane-1");
  });

  it("is a no-op when only one pane exists", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "CLOSE_PANE", paneId: "pane-1" },
    ]);
    expect(s.panes).toHaveLength(1);
  });
});

// ---------- TOGGLE_SIDEBAR ----------

describe("TOGGLE_SIDEBAR", () => {
  it("toggles sidebar open/closed", () => {
    expect(initialState.sidebarOpen).toBe(true);
    const s1 = reducer(initialState, { type: "TOGGLE_SIDEBAR" });
    expect(s1.sidebarOpen).toBe(false);
    const s2 = reducer(s1, { type: "TOGGLE_SIDEBAR" });
    expect(s2.sidebarOpen).toBe(true);
  });
});

// ---------- SET_RIGHT_PANEL ----------

describe("SET_RIGHT_PANEL", () => {
  it("sets the right panel value", () => {
    const s = reducer(initialState, {
      type: "SET_RIGHT_PANEL",
      panel: "backlinks",
    });
    expect(s.rightPanel).toBe("backlinks");
  });

  it("toggles off when same panel is set again", () => {
    const s = apply([
      { type: "SET_RIGHT_PANEL", panel: "chat" },
      { type: "SET_RIGHT_PANEL", panel: "chat" },
    ]);
    expect(s.rightPanel).toBeNull();
  });
});

// ---------- OPEN_GRAPH ----------

describe("OPEN_GRAPH", () => {
  it("opens a graph tab in the active pane", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_GRAPH" },
    ]);
    const pane = s.panes[0]!;
    expect(pane.tabs).toHaveLength(1);
    expect(pane.tabs[0]!.type).toBe("graph");
    expect(pane.activeTabId).toBe(pane.tabs[0]!.id);
  });

  it("reactivates existing graph tab instead of duplicating", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_GRAPH" },
      { type: "OPEN_NOTE", noteId: noteB },
      { type: "OPEN_GRAPH" }, // should reactivate existing graph tab
    ]);
    const pane = s.panes[0]!;
    const graphTabs = pane.tabs.filter((t) => t.type === "graph");
    expect(graphTabs).toHaveLength(1);
    expect(pane.activeTabId).toBe(graphTabs[0]!.id);
  });

  it("works alongside note tabs", () => {
    const s = apply([
      { type: "SET_VAULT", vaultId },
      { type: "OPEN_NOTE", noteId: noteA },
      { type: "OPEN_GRAPH" },
      { type: "OPEN_NOTE", noteId: noteB },
    ]);
    const pane = s.panes[0]!;
    expect(pane.tabs).toHaveLength(3);
    expect(pane.tabs.filter((t) => t.type === "note")).toHaveLength(2);
    expect(pane.tabs.filter((t) => t.type === "graph")).toHaveLength(1);
  });
});

// ---------- SET_SEARCH_QUERY ----------

describe("SET_SEARCH_QUERY", () => {
  it("updates the search query", () => {
    const s = reducer(initialState, {
      type: "SET_SEARCH_QUERY",
      query: "hello",
    });
    expect(s.searchQuery).toBe("hello");
  });
});
