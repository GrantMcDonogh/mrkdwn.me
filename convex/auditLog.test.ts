import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const testUser = { name: "Test User", tokenIdentifier: "user|test123" };
const otherUser = { name: "Other User", tokenIdentifier: "user|other456" };

async function setupVault(t: ReturnType<typeof convexTest>) {
  const asUser = t.withIdentity(testUser);
  const vaultId = await asUser.mutation(api.vaults.create, { name: "Test Vault" });
  return { asUser, vaultId };
}

describe("auditLog", () => {
  describe("listByVault", () => {
    it("returns empty list for new vault", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      expect(entries).toEqual([]);
    });

    it("returns audit entries after note creation", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.notes.create, { title: "My Note", vaultId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      expect(entries.length).toBe(1);
      expect(entries[0]!.action).toBe("create");
      expect(entries[0]!.targetType).toBe("note");
      expect(entries[0]!.targetName).toBe("My Note");
    });

    it("returns entries in descending order by timestamp", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.notes.create, { title: "First", vaultId });
      await asUser.mutation(api.notes.create, { title: "Second", vaultId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      expect(entries.length).toBe(2);
      expect(entries[0]!.targetName).toBe("Second");
      expect(entries[1]!.targetName).toBe("First");
    });

    it("respects limit parameter", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.notes.create, { title: "A", vaultId });
      await asUser.mutation(api.notes.create, { title: "B", vaultId });
      await asUser.mutation(api.notes.create, { title: "C", vaultId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId, limit: 2 });
      expect(entries.length).toBe(2);
    });

    it("requires authentication", async () => {
      const t = convexTest(schema, modules);
      const { vaultId } = await setupVault(t);
      await expect(
        t.query(api.auditLog.listByVault, { vaultId })
      ).rejects.toThrow("Not authenticated");
    });

    it("requires vault access", async () => {
      const t = convexTest(schema, modules);
      const { vaultId } = await setupVault(t);
      const asOther = t.withIdentity(otherUser);
      await expect(
        asOther.query(api.auditLog.listByVault, { vaultId })
      ).rejects.toThrow();
    });
  });

  describe("listByTarget", () => {
    it("returns entries for a specific note", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Target Note", vaultId });
      await asUser.mutation(api.notes.update, { id: noteId, content: "updated" });

      const entries = await asUser.query(api.auditLog.listByTarget, {
        targetId: noteId,
        vaultId,
      });
      expect(entries.length).toBe(2);
      expect(entries[0]!.action).toBe("update");
      expect(entries[1]!.action).toBe("create");
    });
  });

  describe("folder audit logging", () => {
    it("logs folder create", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.folders.create, { name: "My Folder", vaultId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      expect(entries.length).toBe(1);
      expect(entries[0]!.action).toBe("create");
      expect(entries[0]!.targetType).toBe("folder");
    });

    it("logs folder rename with metadata", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Old Name", vaultId });
      await asUser.mutation(api.folders.rename, { id: folderId, name: "New Name" });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      const renameEntry = entries.find((e) => e.action === "rename");
      expect(renameEntry).toBeDefined();
      expect(renameEntry!.metadata).toEqual({ oldName: "Old Name", newName: "New Name" });
    });

    it("logs folder move", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const parentId = await asUser.mutation(api.folders.create, { name: "Parent", vaultId });
      const childId = await asUser.mutation(api.folders.create, { name: "Child", vaultId });
      await asUser.mutation(api.folders.move, { id: childId, parentId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      const moveEntry = entries.find((e) => e.action === "move");
      expect(moveEntry).toBeDefined();
      expect(moveEntry!.targetType).toBe("folder");
    });

    it("logs folder delete", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "To Delete", vaultId });
      await asUser.mutation(api.folders.remove, { id: folderId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      const deleteEntry = entries.find((e) => e.action === "delete");
      expect(deleteEntry).toBeDefined();
      expect(deleteEntry!.targetType).toBe("folder");
    });
  });

  describe("note audit actions", () => {
    it("logs note rename with old/new title", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Old Title", vaultId });
      await asUser.mutation(api.notes.rename, { id: noteId, title: "New Title" });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      const renameEntry = entries.find((e) => e.action === "rename");
      expect(renameEntry).toBeDefined();
      expect(renameEntry!.metadata).toEqual({ oldTitle: "Old Title", newTitle: "New Title" });
    });

    it("logs note move with folder info", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Target", vaultId });
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      await asUser.mutation(api.notes.move, { id: noteId, folderId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      const moveEntry = entries.find((e) => e.action === "move" && e.targetType === "note");
      expect(moveEntry).toBeDefined();
      expect(moveEntry!.metadata.fromFolder).toBeNull();
      expect(moveEntry!.metadata.toFolder).toBe(folderId);
    });

    it("logs note delete", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "To Delete", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });
      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      const deleteEntry = entries.find((e) => e.action === "delete");
      expect(deleteEntry).toBeDefined();
      expect(deleteEntry!.targetName).toBe("To Delete");
    });
  });
});
