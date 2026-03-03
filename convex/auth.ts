import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

export type VaultRole = "owner" | "editor" | "viewer";

const ROLE_LEVEL: Record<VaultRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export async function getVaultRole(
  db: GenericDatabaseReader<DataModel>,
  vaultId: Id<"vaults">,
  userId: string
): Promise<VaultRole | null> {
  const vault = await db.get(vaultId);
  if (!vault) return null;
  if (vault.userId === userId) return "owner";

  const membership = await db
    .query("vaultMembers")
    .withIndex("by_vault_user", (q) =>
      q.eq("vaultId", vaultId).eq("userId", userId)
    )
    .first();

  if (membership && membership.status === "accepted") {
    return membership.role;
  }
  return null;
}

export async function verifyVaultAccess(
  db: GenericDatabaseReader<DataModel>,
  vaultId: Id<"vaults">,
  userId: string,
  minimumRole: VaultRole
): Promise<VaultRole> {
  const role = await getVaultRole(db, vaultId, userId);
  if (!role || ROLE_LEVEL[role] < ROLE_LEVEL[minimumRole]) {
    throw new Error("Vault not found");
  }
  return role;
}

export const checkVaultAccess = internalQuery({
  args: {
    vaultId: v.id("vaults"),
    userId: v.string(),
    minimumRole: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const role = await getVaultRole(ctx.db, args.vaultId, args.userId);
    if (!role || ROLE_LEVEL[role] < ROLE_LEVEL[args.minimumRole]) {
      return null;
    }
    return role;
  },
});
