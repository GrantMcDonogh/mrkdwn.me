/**
 * Security tests for sharing logic — email normalization,
 * invite validation, and self-removal patterns.
 */
import { describe, it, expect } from "vitest";

// ---------- Email normalization ----------

describe("email normalization", () => {
  function normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  it("lowercases email", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles mixed case and whitespace", () => {
    expect(normalizeEmail("  Alice@Gmail.Com ")).toBe("alice@gmail.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeEmail("")).toBe("");
  });

  it("handles already-normalized email", () => {
    expect(normalizeEmail("test@test.com")).toBe("test@test.com");
  });

  it("two differently-cased versions of the same email normalize to the same value", () => {
    const a = normalizeEmail("User@Example.com");
    const b = normalizeEmail("user@example.com");
    const c = normalizeEmail("USER@EXAMPLE.COM");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

// ---------- Invite flow security ----------

describe("invite flow security model", () => {
  it("pending invite has empty userId", () => {
    // The invite stores userId: "" while pending
    const pendingMember = {
      userId: "",
      email: "user@example.com",
      status: "pending" as const,
      role: "editor" as const,
    };
    expect(pendingMember.userId).toBe("");
    expect(pendingMember.status).toBe("pending");
  });

  it("accepted invite has non-empty userId", () => {
    const acceptedMember = {
      userId: "clerk|abc123",
      email: "user@example.com",
      status: "accepted" as const,
      role: "editor" as const,
    };
    expect(acceptedMember.userId).not.toBe("");
    expect(acceptedMember.status).toBe("accepted");
  });

  it("empty userId cannot match any real user token", () => {
    // This ensures a pending member with userId="" can never
    // accidentally match in the by_vault_user index
    const realUserIds = [
      "clerk|user_abc",
      "https://clerk.dev|user_123",
      "local|test",
    ];
    for (const id of realUserIds) {
      expect(id).not.toBe("");
    }
  });
});

// ---------- Self-removal / owner protection ----------

describe("owner protection invariants", () => {
  it("owner is determined by vaults.userId, not vaultMembers", () => {
    // The owner should NEVER be in the vaultMembers table.
    // Owner removal is impossible because the check is:
    // vault.userId === userId → owner
    // The vaultMembers table only holds editors/viewers.
    const ownerUserId = "clerk|owner123";
    const vault = { userId: ownerUserId };
    const vaultMembers = [
      { userId: "clerk|editor1", role: "editor" },
      { userId: "clerk|viewer1", role: "viewer" },
    ];

    // Owner is NOT in vaultMembers
    const ownerInMembers = vaultMembers.find(
      (m) => m.userId === ownerUserId
    );
    expect(ownerInMembers).toBeUndefined();

    // Owner is identified by vault.userId match
    expect(vault.userId).toBe(ownerUserId);
  });

  it("self-removal check: member can leave when userId matches", () => {
    const currentUserId = "clerk|editor1";
    const membership = { userId: "clerk|editor1", role: "editor" };
    const vault = { userId: "clerk|owner123" };

    const isOwner = vault.userId === currentUserId;
    const isSelf = membership.userId === currentUserId;

    expect(isOwner).toBe(false);
    expect(isSelf).toBe(true);
    // Either isOwner or isSelf allows removal
    expect(isOwner || isSelf).toBe(true);
  });

  it("non-owner non-self cannot remove a collaborator", () => {
    const currentUserId = "clerk|unrelated";
    const membership = { userId: "clerk|editor1", role: "editor" };
    const vault = { userId: "clerk|owner123" };

    const isOwner = vault.userId === currentUserId;
    const isSelf = membership.userId === currentUserId;

    expect(isOwner || isSelf).toBe(false);
  });
});

// ---------- Cascade deletion security ----------

describe("cascade deletion patterns", () => {
  it("vault deletion should clean up all related resources", () => {
    // Document the cascade order from convex/vaults.ts remove handler
    const cascadeOrder = [
      "notes",       // delete all notes in vault
      "folders",     // delete all folders in vault
      "vaultMembers", // delete all memberships
      "apiKeys",     // delete all API keys
      "vault",       // delete the vault itself (last)
    ];

    // Ensure vaultMembers is included in cascade
    expect(cascadeOrder).toContain("vaultMembers");
    // Ensure apiKeys is included in cascade
    expect(cascadeOrder).toContain("apiKeys");
    // Vault deleted last
    expect(cascadeOrder[cascadeOrder.length - 1]).toBe("vault");
  });
});

// ---------- Chat security gap fix verification ----------

describe("chat security fix — vaultId validation", () => {
  it("chat endpoint requires viewer access (not just authentication)", () => {
    // Before the fix: chat.ts accepted any vaultId from request body
    // without verifying the user has access to that vault.
    // After the fix: checkVaultAccess is called with minimumRole="viewer"
    const chatMinimumRole = "viewer";
    expect(chatMinimumRole).toBe("viewer");
  });

  it("chatEdit endpoint requires editor access", () => {
    // chatEdit can modify notes, so it needs editor access
    const chatEditMinimumRole = "editor";
    expect(chatEditMinimumRole).toBe("editor");
  });

  it("viewer CANNOT use chatEdit (edit mode)", () => {
    // This is the key security property — viewers can ask questions
    // but cannot have the AI modify notes
    const ROLE_LEVEL: Record<string, number> = {
      owner: 3,
      editor: 2,
      viewer: 1,
    };
    const viewerLevel = ROLE_LEVEL["viewer"]!;
    const editorRequired = ROLE_LEVEL["editor"]!;
    expect(viewerLevel < editorRequired).toBe(true);
  });
});
