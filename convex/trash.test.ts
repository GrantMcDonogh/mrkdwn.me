import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

const testUser = { name: "Test User", tokenIdentifier: "user|test123" };
const editorUser = { name: "Editor", tokenIdentifier: "user|editor789" };

async function setupVault(t: ReturnType<typeof convexTest>) {
  const asUser = t.withIdentity(testUser);
  const vaultId = await asUser.mutation(api.vaults.create, { name: "Test Vault" });
  return { asUser, vaultId };
}

async function addEditor(t: ReturnType<typeof convexTest>, vaultId: Id<"vaults">) {
  await t.run(async (ctx) => {
    await ctx.db.insert("vaultMembers", {
      vaultId,
      userId: editorUser.tokenIdentifier,
      email: "editor@test.com",
      role: "editor",
      invitedBy: testUser.tokenIdentifier,
      invitedAt: Date.now(),
      status: "accepted",
      acceptedAt: Date.now(),
    });
  });
  return t.withIdentity(editorUser);
}

describe("trash", () => {
  describe("listDeleted", () => {
    it("returns empty list when nothing is deleted", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.notes.create, { title: "Active", vaultId });

      const deleted = await asUser.query(api.trash.listDeleted, { vaultId });
      expect(deleted.length).toBe(0);
    });

    it("returns deleted notes", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });

      const deleted = await asUser.query(api.trash.listDeleted, { vaultId });
      expect(deleted.length).toBe(1);
      expect(deleted[0]!.type).toBe("note");
      expect(deleted[0]!.name).toBe("Note");
    });

    it("returns deleted folders", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      await asUser.mutation(api.folders.remove, { id: folderId });

      const deleted = await asUser.query(api.trash.listDeleted, { vaultId });
      expect(deleted.some((d) => d.type === "folder" && d.name === "Folder")).toBe(true);
    });

    it("sorted by deletedAt descending", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const note1 = await asUser.mutation(api.notes.create, { title: "First", vaultId });
      const note2 = await asUser.mutation(api.notes.create, { title: "Second", vaultId });
      await asUser.mutation(api.notes.remove, { id: note1 });
      await asUser.mutation(api.notes.remove, { id: note2 });

      const deleted = await asUser.query(api.trash.listDeleted, { vaultId });
      expect(deleted[0]!.deletedAt).toBeGreaterThanOrEqual(deleted[1]!.deletedAt);
    });
  });

  describe("getDeletedCount", () => {
    it("returns 0 when nothing deleted", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const count = await asUser.query(api.trash.getDeletedCount, { vaultId });
      expect(count).toBe(0);
    });

    it("counts deleted notes and folders", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });
      await asUser.mutation(api.folders.remove, { id: folderId });

      const count = await asUser.query(api.trash.getDeletedCount, { vaultId });
      expect(count).toBe(2);
    });
  });

  describe("restoreNote", () => {
    it("restores a deleted note back to the list", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });

      let notes = await asUser.query(api.notes.list, { vaultId });
      expect(notes.length).toBe(0);

      await asUser.mutation(api.trash.restoreNote, { id: noteId });

      notes = await asUser.query(api.notes.list, { vaultId });
      expect(notes.length).toBe(1);
      expect(notes[0]!.isDeleted).toBeUndefined();
      expect(notes[0]!.deletedAt).toBeUndefined();
    });

    it("moves note to root when parent folder is also deleted", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId, folderId });

      // Delete folder (cascades to note)
      await asUser.mutation(api.folders.remove, { id: folderId });

      // Restore note only (folder still deleted)
      await asUser.mutation(api.trash.restoreNote, { id: noteId });

      const note = await asUser.query(api.notes.get, { id: noteId });
      expect(note.isDeleted).toBeUndefined();
      expect(note.folderId).toBeUndefined(); // moved to root
    });

    it("logs restore in audit log", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });
      await asUser.mutation(api.trash.restoreNote, { id: noteId });

      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      expect(entries.some((e) => e.action === "restore")).toBe(true);
    });
  });

  describe("restoreFolder", () => {
    it("restores a deleted folder and its contents", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      await asUser.mutation(api.notes.create, { title: "Note", vaultId, folderId });

      await asUser.mutation(api.folders.remove, { id: folderId });

      let folders = await asUser.query(api.folders.list, { vaultId });
      let notes = await asUser.query(api.notes.list, { vaultId });
      expect(folders.length).toBe(0);
      expect(notes.length).toBe(0);

      await asUser.mutation(api.trash.restoreFolder, { id: folderId });

      folders = await asUser.query(api.folders.list, { vaultId });
      notes = await asUser.query(api.notes.list, { vaultId });
      expect(folders.length).toBe(1);
      expect(notes.length).toBe(1);
    });

    it("restores nested folders and their notes", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const parentId = await asUser.mutation(api.folders.create, { name: "Parent", vaultId });
      const childId = await asUser.mutation(api.folders.create, { name: "Child", vaultId, parentId });
      await asUser.mutation(api.notes.create, { title: "ChildNote", vaultId, folderId: childId });

      await asUser.mutation(api.folders.remove, { id: parentId });

      let folders = await asUser.query(api.folders.list, { vaultId });
      expect(folders.length).toBe(0);

      await asUser.mutation(api.trash.restoreFolder, { id: parentId });

      folders = await asUser.query(api.folders.list, { vaultId });
      const notes = await asUser.query(api.notes.list, { vaultId });
      expect(folders.length).toBe(2);
      expect(notes.length).toBe(1);
    });

    it("moves folder to root when parent is deleted", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const grandparent = await asUser.mutation(api.folders.create, { name: "GP", vaultId });
      const parent = await asUser.mutation(api.folders.create, { name: "P", vaultId, parentId: grandparent });

      // Delete grandparent (cascades)
      await asUser.mutation(api.folders.remove, { id: grandparent });

      // Restore only the child folder
      await asUser.mutation(api.trash.restoreFolder, { id: parent });

      const folders = await asUser.query(api.folders.list, { vaultId });
      const restored = folders.find((f) => f.name === "P");
      expect(restored).toBeDefined();
      expect(restored!.parentId).toBeUndefined(); // moved to root
    });
  });

  describe("permanentDeleteNote", () => {
    it("hard deletes a note", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });
      await asUser.mutation(api.trash.permanentDeleteNote, { id: noteId });

      // Note should no longer exist at all
      await expect(
        asUser.query(api.notes.get, { id: noteId })
      ).rejects.toThrow("Note not found");
    });

    it("deletes associated versions", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
      await asUser.mutation(api.notes.update, { id: noteId, content: "v1" });
      await asUser.mutation(api.notes.remove, { id: noteId });

      // Verify versions exist before permanent delete
      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBeGreaterThan(0);

      await asUser.mutation(api.trash.permanentDeleteNote, { id: noteId });

      // Versions should be gone after permanent delete
      // (note is gone, so listByNote will throw)
      await expect(
        asUser.query(api.noteVersions.listByNote, { noteId })
      ).rejects.toThrow();
    });

    it("requires owner role", async () => {
      const t = convexTest(schema, modules);
      const { vaultId } = await setupVault(t);
      const asEditor = await addEditor(t, vaultId);

      const noteId = await asEditor.mutation(api.notes.create, { title: "Note", vaultId });
      await asEditor.mutation(api.notes.remove, { id: noteId });

      await expect(
        asEditor.mutation(api.trash.permanentDeleteNote, { id: noteId })
      ).rejects.toThrow();
    });

    it("logs permanent_delete in audit log", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Gone", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });
      await asUser.mutation(api.trash.permanentDeleteNote, { id: noteId });

      const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
      expect(entries.some((e) => e.action === "permanent_delete")).toBe(true);
    });
  });

  describe("permanentDeleteFolder", () => {
    it("hard deletes a folder", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const parentId = await asUser.mutation(api.folders.create, { name: "Parent", vaultId });
      await asUser.mutation(api.notes.create, { title: "Child", vaultId, folderId: parentId });
      await asUser.mutation(api.folders.remove, { id: parentId });
      await asUser.mutation(api.trash.permanentDeleteFolder, { id: parentId });

      // Folder should be truly gone
      const deleted = await asUser.query(api.trash.listDeleted, { vaultId });
      expect(deleted.some((d) => d.type === "folder" && d.name === "Parent")).toBe(false);
    });

    it("requires owner role", async () => {
      const t = convexTest(schema, modules);
      const { vaultId } = await setupVault(t);
      const asEditor = await addEditor(t, vaultId);

      const folderId = await asEditor.mutation(api.folders.create, { name: "F", vaultId });
      await asEditor.mutation(api.folders.remove, { id: folderId });

      await expect(
        asEditor.mutation(api.trash.permanentDeleteFolder, { id: folderId })
      ).rejects.toThrow();
    });
  });

  describe("emptyTrash", () => {
    it("permanently deletes all trash items", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "N1", vaultId });
      const folderId = await asUser.mutation(api.folders.create, { name: "F1", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });
      await asUser.mutation(api.folders.remove, { id: folderId });

      let count = await asUser.query(api.trash.getDeletedCount, { vaultId });
      expect(count).toBeGreaterThan(0);

      await asUser.mutation(api.trash.emptyTrash, { vaultId });

      count = await asUser.query(api.trash.getDeletedCount, { vaultId });
      expect(count).toBe(0);
    });

    it("requires owner role", async () => {
      const t = convexTest(schema, modules);
      const { vaultId } = await setupVault(t);
      const asEditor = await addEditor(t, vaultId);

      await expect(
        asEditor.mutation(api.trash.emptyTrash, { vaultId })
      ).rejects.toThrow();
    });

    it("does not affect active notes", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      await asUser.mutation(api.notes.create, { title: "Active", vaultId });
      const deletedId = await asUser.mutation(api.notes.create, { title: "Deleted", vaultId });
      await asUser.mutation(api.notes.remove, { id: deletedId });

      await asUser.mutation(api.trash.emptyTrash, { vaultId });

      const notes = await asUser.query(api.notes.list, { vaultId });
      expect(notes.length).toBe(1);
      expect(notes[0]!.title).toBe("Active");
    });
  });

  describe("purgeExpired", () => {
    it("deletes items older than 5 years", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Old", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });

      // Manually set deletedAt to >5 years ago
      const sixYearsMs = 6 * 365.25 * 24 * 60 * 60 * 1000;
      await t.run(async (ctx) => {
        await ctx.db.patch(noteId, { deletedAt: Date.now() - sixYearsMs });
      });

      await t.mutation(internal.trash.purgeExpired, {});

      // Note should be hard-deleted
      await expect(
        asUser.query(api.notes.get, { id: noteId })
      ).rejects.toThrow();
    });

    it("does not delete recently deleted items", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId } = await setupVault(t);
      const noteId = await asUser.mutation(api.notes.create, { title: "Recent", vaultId });
      await asUser.mutation(api.notes.remove, { id: noteId });

      await t.mutation(internal.trash.purgeExpired, {});

      // Note should still exist (just soft-deleted)
      const note = await asUser.query(api.notes.get, { id: noteId });
      expect(note.isDeleted).toBe(true);
    });
  });
});
