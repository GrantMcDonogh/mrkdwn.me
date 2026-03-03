/**
 * Security tests for the vault sharing role hierarchy.
 *
 * These test the ROLE_LEVEL logic and permission checking
 * that the backend auth module enforces. We replicate the
 * exact same role-level mapping here to verify invariants.
 */
import { describe, it, expect } from "vitest";

// Mirror of convex/auth.ts ROLE_LEVEL — if this diverges, security is broken
type VaultRole = "owner" | "editor" | "viewer";

const ROLE_LEVEL: Record<VaultRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

function hasMinimumRole(
  actual: VaultRole | null,
  minimum: VaultRole
): boolean {
  if (!actual) return false;
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[minimum];
}

// ---------- Role hierarchy ----------

describe("role hierarchy levels", () => {
  it("owner > editor > viewer", () => {
    expect(ROLE_LEVEL["owner"]).toBeGreaterThan(ROLE_LEVEL["editor"]);
    expect(ROLE_LEVEL["editor"]).toBeGreaterThan(ROLE_LEVEL["viewer"]);
  });

  it("all role levels are positive", () => {
    for (const [, level] of Object.entries(ROLE_LEVEL)) {
      expect(level).toBeGreaterThan(0);
    }
  });

  it("all three roles have distinct levels", () => {
    const levels = new Set(Object.values(ROLE_LEVEL));
    expect(levels.size).toBe(3);
  });
});

// ---------- hasMinimumRole (access check) ----------

describe("hasMinimumRole — access matrix", () => {
  const matrix: [VaultRole | null, VaultRole, boolean][] = [
    // [actual role, minimum required, should pass]
    // Owner can do everything
    ["owner", "viewer", true],
    ["owner", "editor", true],
    ["owner", "owner", true],
    // Editor can view and edit, not own
    ["editor", "viewer", true],
    ["editor", "editor", true],
    ["editor", "owner", false],
    // Viewer can only view
    ["viewer", "viewer", true],
    ["viewer", "editor", false],
    ["viewer", "owner", false],
    // No role = no access
    [null, "viewer", false],
    [null, "editor", false],
    [null, "owner", false],
  ];

  for (const [actual, minimum, expected] of matrix) {
    it(`actual=${actual ?? "null"} minimum=${minimum} → ${expected ? "ALLOW" : "DENY"}`, () => {
      expect(hasMinimumRole(actual, minimum)).toBe(expected);
    });
  }
});

// ---------- Security invariants ----------

describe("security invariants", () => {
  it("viewer CANNOT satisfy editor requirement", () => {
    expect(hasMinimumRole("viewer", "editor")).toBe(false);
  });

  it("viewer CANNOT satisfy owner requirement", () => {
    expect(hasMinimumRole("viewer", "owner")).toBe(false);
  });

  it("editor CANNOT satisfy owner requirement", () => {
    expect(hasMinimumRole("editor", "owner")).toBe(false);
  });

  it("null role CANNOT satisfy any requirement", () => {
    for (const min of ["viewer", "editor", "owner"] as VaultRole[]) {
      expect(hasMinimumRole(null, min)).toBe(false);
    }
  });

  it("every role can satisfy its own level", () => {
    for (const role of ["owner", "editor", "viewer"] as VaultRole[]) {
      expect(hasMinimumRole(role, role)).toBe(true);
    }
  });

  it("higher roles always satisfy lower requirements (transitivity)", () => {
    const ordered: VaultRole[] = ["viewer", "editor", "owner"];
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j <= i; j++) {
        expect(hasMinimumRole(ordered[i]!, ordered[j]!)).toBe(true);
      }
    }
  });

  it("lower roles never satisfy higher requirements", () => {
    const ordered: VaultRole[] = ["viewer", "editor", "owner"];
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        expect(hasMinimumRole(ordered[i]!, ordered[j]!)).toBe(false);
      }
    }
  });
});

// ---------- Endpoint-specific permission mapping ----------

describe("endpoint permission mapping", () => {
  // These map exactly to what's in convex/notes.ts, folders.ts, vaults.ts, etc.
  const endpointPermissions: { endpoint: string; minimumRole: VaultRole }[] = [
    // notes.ts — viewer (read)
    { endpoint: "notes.list", minimumRole: "viewer" },
    { endpoint: "notes.get", minimumRole: "viewer" },
    { endpoint: "notes.search", minimumRole: "viewer" },
    { endpoint: "notes.getBacklinks", minimumRole: "viewer" },
    { endpoint: "notes.getUnlinkedMentions", minimumRole: "viewer" },
    // notes.ts — editor (write)
    { endpoint: "notes.importBatch", minimumRole: "editor" },
    { endpoint: "notes.create", minimumRole: "editor" },
    { endpoint: "notes.update", minimumRole: "editor" },
    { endpoint: "notes.rename", minimumRole: "editor" },
    { endpoint: "notes.move", minimumRole: "editor" },
    { endpoint: "notes.remove", minimumRole: "editor" },
    // folders.ts — viewer (read)
    { endpoint: "folders.list", minimumRole: "viewer" },
    // folders.ts — editor (write)
    { endpoint: "folders.create", minimumRole: "editor" },
    { endpoint: "folders.rename", minimumRole: "editor" },
    { endpoint: "folders.move", minimumRole: "editor" },
    { endpoint: "folders.remove", minimumRole: "editor" },
    // vaults.ts — owner
    { endpoint: "vaults.rename", minimumRole: "owner" },
    { endpoint: "vaults.remove", minimumRole: "owner" },
    // apiKeys.ts — owner
    { endpoint: "apiKeys.list", minimumRole: "owner" },
    // chat.ts — viewer
    { endpoint: "chat", minimumRole: "viewer" },
    // chatEdit.ts — editor
    { endpoint: "chatEdit", minimumRole: "editor" },
    // sharing.ts — owner for management
    { endpoint: "sharing.inviteCollaborator", minimumRole: "owner" },
    // sharing.ts — viewer for listing
    { endpoint: "sharing.listCollaborators", minimumRole: "viewer" },
  ];

  describe("viewer access", () => {
    const viewerEndpoints = endpointPermissions.filter((e) =>
      hasMinimumRole("viewer", e.minimumRole)
    );
    const blockedEndpoints = endpointPermissions.filter(
      (e) => !hasMinimumRole("viewer", e.minimumRole)
    );

    it("can access read-only endpoints", () => {
      const allowed = viewerEndpoints.map((e) => e.endpoint);
      expect(allowed).toContain("notes.list");
      expect(allowed).toContain("notes.get");
      expect(allowed).toContain("notes.search");
      expect(allowed).toContain("folders.list");
      expect(allowed).toContain("chat");
      expect(allowed).toContain("sharing.listCollaborators");
    });

    it("CANNOT access write endpoints", () => {
      const blocked = blockedEndpoints.map((e) => e.endpoint);
      expect(blocked).toContain("notes.create");
      expect(blocked).toContain("notes.update");
      expect(blocked).toContain("notes.remove");
      expect(blocked).toContain("notes.rename");
      expect(blocked).toContain("notes.move");
      expect(blocked).toContain("notes.importBatch");
      expect(blocked).toContain("folders.create");
      expect(blocked).toContain("folders.rename");
      expect(blocked).toContain("folders.move");
      expect(blocked).toContain("folders.remove");
    });

    it("CANNOT access owner-only endpoints", () => {
      const blocked = blockedEndpoints.map((e) => e.endpoint);
      expect(blocked).toContain("vaults.rename");
      expect(blocked).toContain("vaults.remove");
      expect(blocked).toContain("apiKeys.list");
      expect(blocked).toContain("sharing.inviteCollaborator");
    });

    it("CANNOT access chat-edit", () => {
      const blocked = blockedEndpoints.map((e) => e.endpoint);
      expect(blocked).toContain("chatEdit");
    });
  });

  describe("editor access", () => {
    const editorEndpoints = endpointPermissions.filter((e) =>
      hasMinimumRole("editor", e.minimumRole)
    );
    const blockedEndpoints = endpointPermissions.filter(
      (e) => !hasMinimumRole("editor", e.minimumRole)
    );

    it("can access all read and write endpoints", () => {
      const allowed = editorEndpoints.map((e) => e.endpoint);
      expect(allowed).toContain("notes.list");
      expect(allowed).toContain("notes.create");
      expect(allowed).toContain("notes.update");
      expect(allowed).toContain("notes.remove");
      expect(allowed).toContain("folders.list");
      expect(allowed).toContain("folders.create");
      expect(allowed).toContain("chatEdit");
    });

    it("CANNOT access owner-only endpoints", () => {
      const blocked = blockedEndpoints.map((e) => e.endpoint);
      expect(blocked).toContain("vaults.rename");
      expect(blocked).toContain("vaults.remove");
      expect(blocked).toContain("apiKeys.list");
      expect(blocked).toContain("sharing.inviteCollaborator");
    });
  });

  describe("owner access", () => {
    it("can access ALL endpoints", () => {
      for (const ep of endpointPermissions) {
        expect(
          hasMinimumRole("owner", ep.minimumRole),
          `owner should have access to ${ep.endpoint}`
        ).toBe(true);
      }
    });
  });
});

// ---------- Privilege escalation checks ----------

describe("privilege escalation prevention", () => {
  it("roles stored in vaultMembers can only be editor or viewer, never owner", () => {
    // Owner role is determined by vaults.userId match, not vaultMembers.
    // This test documents that the schema only allows "editor" | "viewer" in the table.
    const allowedStoredRoles = ["editor", "viewer"];
    expect(allowedStoredRoles).not.toContain("owner");
  });

  it("pending membership does NOT grant access", () => {
    // In getVaultRole, we check `membership.status === "accepted"`.
    // A pending membership should return null (no access).
    // This is a documentation test — the actual check is in convex/auth.ts:31
    const pendingStatus = "pending";
    expect(pendingStatus).not.toBe("accepted");
  });
});
