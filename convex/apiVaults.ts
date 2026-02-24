import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { apiAction, jsonOk, requireAuth, requireQueryParam, parseBody } from "./apiHelpers";

export const listVaults = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const data = await ctx.runQuery(api.vaults.list, {});
  return jsonOk(request, data);
});

export const getVault = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(api.vaults.get, { id: param.value as Id<"vaults"> });
  return jsonOk(request, data);
});

export const createVault = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ name: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { name } = parsed.body;
  if (!name) return jsonOk(request, null, 400);
  const id = await ctx.runMutation(api.vaults.create, { name });
  return jsonOk(request, { id }, 201);
});

export const renameVault = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ id: string; name: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, name } = parsed.body;
  if (!id || !name) return jsonOk(request, null, 400);
  await ctx.runMutation(api.vaults.rename, { id: id as Id<"vaults">, name });
  return jsonOk(request, null);
});

export const deleteVault = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  await ctx.runMutation(api.vaults.remove, { id: param.value as Id<"vaults"> });
  return jsonOk(request, null);
});
