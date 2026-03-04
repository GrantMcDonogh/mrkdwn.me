import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const testUser = { name: "Test User", tokenIdentifier: "user|test123" };

async function setupVault(t: ReturnType<typeof convexTest>) {
  const asUser = t.withIdentity(testUser);
  const vaultId = await asUser.mutation(api.vaults.create, { name: "Test Vault" });
  return { asUser, vaultId };
}

describe("folders soft delete", () => {
  it("removes folder from list after soft delete", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });

    let folders = await asUser.query(api.folders.list, { vaultId });
    expect(folders.length).toBe(1);

    await asUser.mutation(api.folders.remove, { id: folderId });

    folders = await asUser.query(api.folders.list, { vaultId });
    expect(folders.length).toBe(0);
  });

  describe("cascading soft delete", () => {
    it("soft-deletes child folders", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const parentId = await asUser.mutation(api.folders.create, { name: "Parent", vaultId });
      await asUser.mutation(api.folders.create, { name: "Child", vaultId, parentId });

      await asUser.mutation(api.folders.remove, { id: parentId });

      const folders = await asUser.query(api.folders.list, { vaultId });
      expect(folders.length).toBe(0);
    });

    it("soft-deletes grandchild folders", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const grandparent = await asUser.mutation(api.folders.create, { name: "GP", vaultId });
      const parent = await asUser.mutation(api.folders.create, { name: "P", vaultId, parentId: grandparent });
      await asUser.mutation(api.folders.create, { name: "C", vaultId, parentId: parent });

      await asUser.mutation(api.folders.remove, { id: grandparent });

      const folders = await asUser.query(api.folders.list, { vaultId });
      expect(folders.length).toBe(0);
    });

    it("soft-deletes notes inside deleted folder", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      await asUser.mutation(api.notes.create, { title: "Note1", vaultId, folderId });
      await asUser.mutation(api.notes.create, { title: "Note2", vaultId, folderId });

      let notes = await asUser.query(api.notes.list, { vaultId });
      expect(notes.length).toBe(2);

      await asUser.mutation(api.folders.remove, { id: folderId });

      notes = await asUser.query(api.notes.list, { vaultId });
      expect(notes.length).toBe(0);
    });

    it("soft-deletes notes in nested folders", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const parentId = await asUser.mutation(api.folders.create, { name: "Parent", vaultId });
      const childId = await asUser.mutation(api.folders.create, { name: "Child", vaultId, parentId });
      await asUser.mutation(api.notes.create, { title: "Root Note", vaultId });
      await asUser.mutation(api.notes.create, { title: "Parent Note", vaultId, folderId: parentId });
      await asUser.mutation(api.notes.create, { title: "Child Note", vaultId, folderId: childId });

      await asUser.mutation(api.folders.remove, { id: parentId });

      const notes = await asUser.query(api.notes.list, { vaultId });
      expect(notes.length).toBe(1);
      expect(notes[0]!.title).toBe("Root Note");
    });

    it("does NOT affect sibling folders", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.folders.create, { name: "Folder A", vaultId });
      const folderB = await asUser.mutation(api.folders.create, { name: "Folder B", vaultId });

      await asUser.mutation(api.folders.remove, { id: folderB });

      const folders = await asUser.query(api.folders.list, { vaultId });
      expect(folders.length).toBe(1);
      expect(folders[0]!.name).toBe("Folder A");
    });

    it("uses the same deletedAt timestamp for folder and its contents", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      await asUser.mutation(api.notes.create, { title: "Note", vaultId, folderId });

      await asUser.mutation(api.folders.remove, { id: folderId });

      const deleted = await asUser.query(api.trash.listDeleted, { vaultId });
      const timestamps = deleted.map((d) => d.deletedAt);
      // All items should have the same deletedAt
      expect(new Set(timestamps).size).toBe(1);
    });
  });
});
