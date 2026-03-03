import { describe, it, expect } from "vitest";
import {
  reducer,
  initialState,
  canEdit,
  isOwner,
  type Action,
  type VaultRole,
  type WorkspaceState,
} from "./workspace";
import type { Id } from "../../convex/_generated/dataModel";

const vaultId = "vault1" as Id<"vaults">;
const noteA = "noteA" as Id<"notes">;

function apply(actions: Action[], state: WorkspaceState = initialState) {
  return actions.reduce(reducer, state);
}

// ---------- SET_VAULT with role ----------

describe("SET_VAULT role propagation", () => {
  it("defaults to 'owner' when no role is provided", () => {
    const s = reducer(initialState, { type: "SET_VAULT", vaultId });
    expect(s.vaultRole).toBe("owner");
  });

  it("sets role to 'owner' when explicitly passed", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "owner",
    });
    expect(s.vaultRole).toBe("owner");
  });

  it("sets role to 'editor' when passed", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "editor",
    });
    expect(s.vaultRole).toBe("editor");
  });

  it("sets role to 'viewer' when passed", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "viewer",
    });
    expect(s.vaultRole).toBe("viewer");
  });

  it("resets role when switching vaults", () => {
    const s1 = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "viewer",
    });
    const vault2 = "vault2" as Id<"vaults">;
    const s2 = reducer(s1, {
      type: "SET_VAULT",
      vaultId: vault2,
      role: "editor",
    });
    expect(s2.vaultRole).toBe("editor");
    expect(s2.vaultId).toBe(vault2);
  });
});

// ---------- LEAVE_VAULT clears role ----------

describe("LEAVE_VAULT clears role", () => {
  it("resets vaultRole to null", () => {
    const withVault = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "editor",
    });
    expect(withVault.vaultRole).toBe("editor");
    const s = reducer(withVault, { type: "LEAVE_VAULT" });
    expect(s.vaultRole).toBeNull();
    expect(s.vaultId).toBeNull();
  });
});

// ---------- canEdit helper ----------

describe("canEdit", () => {
  it("returns true for owner", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "owner",
    });
    expect(canEdit(s)).toBe(true);
  });

  it("returns true for editor", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "editor",
    });
    expect(canEdit(s)).toBe(true);
  });

  it("returns false for viewer", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "viewer",
    });
    expect(canEdit(s)).toBe(false);
  });

  it("returns false when no vault is selected", () => {
    expect(canEdit(initialState)).toBe(false);
  });
});

// ---------- isOwner helper ----------

describe("isOwner", () => {
  it("returns true for owner", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "owner",
    });
    expect(isOwner(s)).toBe(true);
  });

  it("returns false for editor", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "editor",
    });
    expect(isOwner(s)).toBe(false);
  });

  it("returns false for viewer", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "viewer",
    });
    expect(isOwner(s)).toBe(false);
  });

  it("returns false when no vault is selected", () => {
    expect(isOwner(initialState)).toBe(false);
  });
});

// ---------- TOGGLE_TAB_MODE still works regardless of role ----------
// (The frontend gate is in the component, not the reducer)

describe("TOGGLE_TAB_MODE in reducer", () => {
  it("toggles mode for any role (reducer is role-agnostic)", () => {
    for (const role of ["owner", "editor", "viewer"] as VaultRole[]) {
      const s = apply([
        { type: "SET_VAULT", vaultId, role },
        { type: "OPEN_NOTE", noteId: noteA },
      ]);
      const pane = s.panes[0]!;
      const tab = pane.tabs[0]!;
      expect(tab.mode).toBe("preview"); // default

      const toggled = reducer(s, {
        type: "TOGGLE_TAB_MODE",
        paneId: pane.id,
        tabId: tab.id,
      });
      expect(toggled.panes[0]!.tabs[0]!.mode).toBe("edit");
    }
  });
});

// ---------- initialState has null role ----------

describe("initialState", () => {
  it("has vaultRole set to null", () => {
    expect(initialState.vaultRole).toBeNull();
  });

  it("has vaultId set to null", () => {
    expect(initialState.vaultId).toBeNull();
  });
});

// ---------- Role hierarchy invariants ----------

describe("role hierarchy invariants", () => {
  const scenarios: { role: VaultRole; canEditExpected: boolean; isOwnerExpected: boolean }[] = [
    { role: "owner", canEditExpected: true, isOwnerExpected: true },
    { role: "editor", canEditExpected: true, isOwnerExpected: false },
    { role: "viewer", canEditExpected: false, isOwnerExpected: false },
  ];

  for (const { role, canEditExpected, isOwnerExpected } of scenarios) {
    it(`${role}: canEdit=${canEditExpected}, isOwner=${isOwnerExpected}`, () => {
      const s = reducer(initialState, {
        type: "SET_VAULT",
        vaultId,
        role,
      });
      expect(canEdit(s)).toBe(canEditExpected);
      expect(isOwner(s)).toBe(isOwnerExpected);
    });
  }

  it("viewer cannot edit implies viewer is not owner", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "viewer",
    });
    // If canEdit is false, isOwner must also be false
    if (!canEdit(s)) {
      expect(isOwner(s)).toBe(false);
    }
  });

  it("isOwner implies canEdit", () => {
    const s = reducer(initialState, {
      type: "SET_VAULT",
      vaultId,
      role: "owner",
    });
    if (isOwner(s)) {
      expect(canEdit(s)).toBe(true);
    }
  });
});
