import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  vaults: defineTable({
    name: v.string(),
    userId: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    vaultId: v.id("vaults"),
    order: v.number(),
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
});
