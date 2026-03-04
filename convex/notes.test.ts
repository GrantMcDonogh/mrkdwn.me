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

describe("notes soft delete", () => {
  it("removes note from list after soft delete", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });

    let notes = await asUser.query(api.notes.list, { vaultId });
    expect(notes.length).toBe(1);

    await asUser.mutation(api.notes.remove, { id: noteId });

    notes = await asUser.query(api.notes.list, { vaultId });
    expect(notes.length).toBe(0);
  });

  it("note still accessible via get after soft delete (for trash viewing)", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
    await asUser.mutation(api.notes.remove, { id: noteId });

    const note = await asUser.query(api.notes.get, { id: noteId });
    expect(note).toBeDefined();
    expect(note.isDeleted).toBe(true);
    expect(note.deletedAt).toBeDefined();
    expect(note.deletedBy).toBe(testUser.tokenIdentifier);
  });

  it("excludes deleted notes from search results", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    const noteId = await asUser.mutation(api.notes.create, { title: "Searchable", vaultId });
    await asUser.mutation(api.notes.update, { id: noteId, content: "unique content" });
    await asUser.mutation(api.notes.remove, { id: noteId });

    const results = await asUser.query(api.notes.search, { vaultId, query: "Searchable" });
    expect(results.length).toBe(0);
  });

  it("excludes deleted notes from backlinks", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);

    const targetId = await asUser.mutation(api.notes.create, { title: "Target", vaultId });
    const linkerId = await asUser.mutation(api.notes.create, { title: "Linker", vaultId });
    await asUser.mutation(api.notes.update, { id: linkerId, content: "See [[Target]]" });

    let backlinks = await asUser.query(api.notes.getBacklinks, { noteId: targetId });
    expect(backlinks.length).toBe(1);

    // Delete the linking note
    await asUser.mutation(api.notes.remove, { id: linkerId });

    backlinks = await asUser.query(api.notes.getBacklinks, { noteId: targetId });
    expect(backlinks.length).toBe(0);
  });

  it("excludes deleted notes from unlinked mentions", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);

    const targetId = await asUser.mutation(api.notes.create, { title: "Target", vaultId });
    const mentionerId = await asUser.mutation(api.notes.create, { title: "Mentioner", vaultId });
    await asUser.mutation(api.notes.update, { id: mentionerId, content: "mentions Target here" });

    let mentions = await asUser.query(api.notes.getUnlinkedMentions, { noteId: targetId });
    expect(mentions.length).toBe(1);

    await asUser.mutation(api.notes.remove, { id: mentionerId });

    mentions = await asUser.query(api.notes.getUnlinkedMentions, { noteId: targetId });
    expect(mentions.length).toBe(0);
  });
});

describe("notes updatedBy tracking", () => {
  it("sets updatedBy on content update", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    const noteId = await asUser.mutation(api.notes.create, { title: "Note", vaultId });
    await asUser.mutation(api.notes.update, { id: noteId, content: "updated" });

    const note = await asUser.query(api.notes.get, { id: noteId });
    expect(note.updatedBy).toBe(testUser.tokenIdentifier);
  });

  it("sets updatedBy on rename", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    const noteId = await asUser.mutation(api.notes.create, { title: "Old", vaultId });
    await asUser.mutation(api.notes.rename, { id: noteId, title: "New" });

    const note = await asUser.query(api.notes.get, { id: noteId });
    expect(note.updatedBy).toBe(testUser.tokenIdentifier);
  });
});

describe("notes import batch audit logging", () => {
  it("creates audit entries for each imported note", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);
    await asUser.mutation(api.notes.importBatch, {
      notes: [
        { title: "Import1", content: "c1", vaultId, order: 0 },
        { title: "Import2", content: "c2", vaultId, order: 1 },
      ],
    });

    const entries = await asUser.query(api.auditLog.listByVault, { vaultId });
    const createEntries = entries.filter((e) => e.action === "create" && e.targetType === "note");
    expect(createEntries.length).toBe(2);
  });
});

describe("wiki link rename with soft-deleted notes", () => {
  it("skips deleted notes during wiki link propagation", async () => {
    const t = convexTest(schema, modules);
    const { asUser, vaultId } = await setupVault(t);

    const noteA = await asUser.mutation(api.notes.create, { title: "Original", vaultId });
    const noteB = await asUser.mutation(api.notes.create, { title: "Linker", vaultId });
    const noteC = await asUser.mutation(api.notes.create, { title: "DeletedLinker", vaultId });

    await asUser.mutation(api.notes.update, { id: noteB, content: "See [[Original]]" });
    await asUser.mutation(api.notes.update, { id: noteC, content: "See [[Original]]" });

    // Soft delete noteC
    await asUser.mutation(api.notes.remove, { id: noteC });

    // Rename should propagate to noteB but skip deleted noteC
    await asUser.mutation(api.notes.rename, { id: noteA, title: "Renamed" });

    const updatedB = await asUser.query(api.notes.get, { id: noteB });
    expect(updatedB.content).toBe("See [[Renamed]]");

    // Deleted note content should be unchanged
    const deletedC = await asUser.query(api.notes.get, { id: noteC });
    expect(deletedC.content).toBe("See [[Original]]");
  });
});
