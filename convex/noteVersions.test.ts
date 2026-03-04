import { convexTest } from "convex-test";
import { describe, it, expect, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const testUser = { name: "Test User", tokenIdentifier: "user|test123" };

async function setupVaultAndNote(t: ReturnType<typeof convexTest>) {
  const asUser = t.withIdentity(testUser);
  const vaultId = await asUser.mutation(api.vaults.create, { name: "Test Vault" });
  const noteId = await asUser.mutation(api.notes.create, { title: "Test Note", vaultId });
  return { asUser, vaultId, noteId };
}

describe("noteVersions", () => {
  describe("auto snapshot on update", () => {
    it("creates a snapshot on first update", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);
      await asUser.mutation(api.notes.update, { id: noteId, content: "Hello world" });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBe(1);
      expect(versions[0]!.trigger).toBe("auto");
      expect(versions[0]!.content).toBe(""); // snapshot of state before update
      expect(versions[0]!.title).toBe("Test Note");
    });

    it("throttles auto snapshots within 5 minutes", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      // First update creates a snapshot
      await asUser.mutation(api.notes.update, { id: noteId, content: "v1" });
      // Second update within 5 min should NOT create another
      await asUser.mutation(api.notes.update, { id: noteId, content: "v2" });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBe(1);
    });
  });

  describe("forced snapshots", () => {
    it("always creates snapshot on rename regardless of throttle", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      // First update (creates auto snapshot)
      await asUser.mutation(api.notes.update, { id: noteId, content: "content" });
      // Rename immediately (should create another snapshot)
      await asUser.mutation(api.notes.rename, { id: noteId, title: "Renamed" });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBe(2);
      const triggers = versions.map((v) => v.trigger);
      expect(triggers).toContain("auto");
      expect(triggers).toContain("rename");
    });

    it("always creates snapshot on move", async () => {
      const t = convexTest(schema, modules);
      const { asUser, vaultId, noteId } = await setupVaultAndNote(t);

      await asUser.mutation(api.notes.update, { id: noteId, content: "content" });
      const folderId = await asUser.mutation(api.folders.create, { name: "Folder", vaultId });
      await asUser.mutation(api.notes.move, { id: noteId, folderId });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBe(2);
      expect(versions.some((v) => v.trigger === "move")).toBe(true);
    });

    it("always creates snapshot on delete", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      await asUser.mutation(api.notes.update, { id: noteId, content: "important data" });
      await asUser.mutation(api.notes.remove, { id: noteId });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBe(2);
      expect(versions.some((v) => v.trigger === "delete")).toBe(true);
    });
  });

  describe("listByNote", () => {
    it("returns versions in descending order", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      await asUser.mutation(api.notes.update, { id: noteId, content: "v1" });
      await asUser.mutation(api.notes.rename, { id: noteId, title: "Renamed" });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      expect(versions.length).toBe(2);
      // Newest first
      expect(versions[0]!.savedAt).toBeGreaterThanOrEqual(versions[1]!.savedAt);
    });

    it("requires authentication", async () => {
      const t = convexTest(schema, modules);
      const { noteId } = await setupVaultAndNote(t);
      await expect(
        t.query(api.noteVersions.listByNote, { noteId })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("get", () => {
    it("returns a specific version", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      await asUser.mutation(api.notes.update, { id: noteId, content: "hello" });
      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      const version = await asUser.query(api.noteVersions.get, { id: versions[0]!._id });
      expect(version.title).toBe("Test Note");
      expect(version.content).toBe(""); // snapshot taken before update
    });
  });

  describe("restoreVersion", () => {
    it("restores note content from a version", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      await asUser.mutation(api.notes.update, { id: noteId, content: "original content" });
      await asUser.mutation(api.notes.rename, { id: noteId, title: "Renamed" });
      await asUser.mutation(api.notes.update, { id: noteId, content: "new content" });

      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });
      // Find the rename snapshot (has the original content)
      const renameVersion = versions.find((v) => v.trigger === "rename");
      expect(renameVersion).toBeDefined();

      await asUser.mutation(api.noteVersions.restoreVersion, {
        noteId,
        versionId: renameVersion!._id,
      });

      const note = await asUser.query(api.notes.get, { id: noteId });
      expect(note.title).toBe(renameVersion!.title);
      expect(note.content).toBe(renameVersion!.content);
    });

    it("requires editor access", async () => {
      const t = convexTest(schema, modules);
      const { asUser, noteId } = await setupVaultAndNote(t);

      await asUser.mutation(api.notes.update, { id: noteId, content: "content" });
      const versions = await asUser.query(api.noteVersions.listByNote, { noteId });

      const viewer = t.withIdentity({ name: "Viewer", tokenIdentifier: "user|viewer" });
      await expect(
        viewer.mutation(api.noteVersions.restoreVersion, {
          noteId,
          versionId: versions[0]!._id,
        })
      ).rejects.toThrow();
    });
  });
});
