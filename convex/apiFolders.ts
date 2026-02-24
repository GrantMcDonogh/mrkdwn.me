import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { apiAction, jsonOk, requireAuth, requireQueryParam, parseBody } from "./apiHelpers";

export const listFolders = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "vaultId");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(api.folders.list, { vaultId: param.value as Id<"vaults"> });
  return jsonOk(request, data);
});

export const createFolder = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ name: string; vaultId: string; parentId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { name, vaultId, parentId } = parsed.body;
  if (!name || !vaultId) return jsonOk(request, null, 400);
  const id = await ctx.runMutation(api.folders.create, {
    name,
    vaultId: vaultId as Id<"vaults">,
    parentId: parentId ? (parentId as Id<"folders">) : undefined,
  });
  return jsonOk(request, { id }, 201);
});

export const renameFolder = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ id: string; name: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, name } = parsed.body;
  if (!id || !name) return jsonOk(request, null, 400);
  await ctx.runMutation(api.folders.rename, { id: id as Id<"folders">, name });
  return jsonOk(request, null);
});

export const moveFolder = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ id: string; parentId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, parentId } = parsed.body;
  if (!id) return jsonOk(request, null, 400);
  await ctx.runMutation(api.folders.move, {
    id: id as Id<"folders">,
    parentId: parentId ? (parentId as Id<"folders">) : undefined,
  });
  return jsonOk(request, null);
});

export const deleteFolder = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  await ctx.runMutation(api.folders.remove, { id: param.value as Id<"folders"> });
  return jsonOk(request, null);
});
