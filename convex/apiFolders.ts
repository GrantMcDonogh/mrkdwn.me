import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { apiKeyAction, jsonOk, jsonError, requireQueryParam, parseBody } from "./apiHelpers";

export const listFolders = apiKeyAction(async (ctx, request, auth) => {
  const data = await ctx.runQuery(internal.internalApi.listFolders, { vaultId: auth.vaultId });
  return jsonOk(request, data);
});

export const createFolder = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ name: string; parentId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { name, parentId } = parsed.body;
  if (!name) return jsonError(request, "Missing required field: name", 400);
  const id = await ctx.runMutation(internal.internalApi.createFolder, {
    name,
    vaultId: auth.vaultId,
    parentId: parentId ? (parentId as Id<"folders">) : undefined,
  });
  return jsonOk(request, { id }, 201);
});

export const renameFolder = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ id: string; name: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, name } = parsed.body;
  if (!id || !name) return jsonError(request, "Missing required fields: id, name", 400);
  await ctx.runMutation(internal.internalApi.renameFolder, {
    id: id as Id<"folders">,
    vaultId: auth.vaultId,
    name,
  });
  return jsonOk(request, null);
});

export const moveFolder = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ id: string; parentId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, parentId } = parsed.body;
  if (!id) return jsonError(request, "Missing required field: id", 400);
  await ctx.runMutation(internal.internalApi.moveFolder, {
    id: id as Id<"folders">,
    vaultId: auth.vaultId,
    parentId: parentId ? (parentId as Id<"folders">) : undefined,
  });
  return jsonOk(request, null);
});

export const deleteFolder = apiKeyAction(async (ctx, request, auth) => {
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  await ctx.runMutation(internal.internalApi.removeFolder, {
    id: param.value as Id<"folders">,
    vaultId: auth.vaultId,
  });
  return jsonOk(request, null);
});
