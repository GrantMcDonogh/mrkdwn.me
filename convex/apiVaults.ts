import { internal } from "./_generated/api";
import { apiKeyAction, jsonOk } from "./apiHelpers";

export const getVault = apiKeyAction(async (ctx, request, auth) => {
  const data = await ctx.runQuery(internal.internalApi.getVault, { vaultId: auth.vaultId });
  return jsonOk(request, data);
});
