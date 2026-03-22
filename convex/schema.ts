import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  vaults: defineTable({
    name: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    settings: v.optional(v.any()),
  }).index("by_user", ["userId"]),

  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    vaultId: v.id("vaults"),
    order: v.number(),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
  })
    .index("by_vault", ["vaultId"])
    .index("by_parent", ["vaultId", "parentId"]),

  notes: defineTable({
    title: v.string(),
    content: v.string(),
    folderId: v.optional(v.id("folders")),
    vaultId: v.id("vaults"),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
  })
    .index("by_vault", ["vaultId"])
    .index("by_folder", ["vaultId", "folderId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["vaultId"],
    })
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["vaultId"],
    }),
  userSettings: defineTable({
    userId: v.string(),
    openRouterKey: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  vaultMembers: defineTable({
    vaultId: v.id("vaults"),
    userId: v.string(),
    email: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    invitedBy: v.string(),
    invitedAt: v.number(),
    status: v.union(v.literal("pending"), v.literal("accepted")),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_vault", ["vaultId"])
    .index("by_user", ["userId"])
    .index("by_vault_user", ["vaultId", "userId"])
    .index("by_email_status", ["email", "status"]),

  auditLog: defineTable({
    vaultId: v.id("vaults"),
    userId: v.string(),
    action: v.union(
      v.literal("create"), v.literal("update"), v.literal("rename"),
      v.literal("move"), v.literal("delete"), v.literal("restore"),
      v.literal("permanent_delete")
    ),
    targetType: v.union(v.literal("note"), v.literal("folder")),
    targetId: v.string(),
    targetName: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_vault", ["vaultId", "timestamp"])
    .index("by_target", ["targetId", "timestamp"]),

  noteVersions: defineTable({
    noteId: v.id("notes"),
    vaultId: v.id("vaults"),
    title: v.string(),
    content: v.string(),
    savedBy: v.string(),
    savedAt: v.number(),
    trigger: v.union(
      v.literal("auto"), v.literal("rename"),
      v.literal("move"), v.literal("delete")
    ),
  })
    .index("by_note", ["noteId", "savedAt"])
    .index("by_vault", ["vaultId", "savedAt"]),

  chatSessions: defineTable({
    vaultId: v.id("vaults"),
    userId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_vault_user", ["vaultId", "userId", "updatedAt"]),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId", "createdAt"]),

  apiKeys: defineTable({
    keyHash: v.string(),
    keyPrefix: v.string(),
    vaultId: v.id("vaults"),
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_hash", ["keyHash"])
    .index("by_vault", ["vaultId"]),
});
