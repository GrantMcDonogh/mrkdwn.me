import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// --- CORS ---

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "origin",
  };
}

function optionsResponse(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// --- JSON responses ---

function jsonOk(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function jsonError(request: Request, message: string, status: number) {
  // Never use 502 — Convex strips CORS headers from 502 responses
  const safeStatus = status === 502 ? 400 : status;
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: safeStatus,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

// --- Auth ---

async function requireAuth(ctx: ActionCtx, request: Request) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { identity: null, errorResponse: jsonError(request, "Unauthorized", 401) };
  return { identity, errorResponse: null };
}

// --- Query params ---

function getQueryParam(request: Request, name: string): string | null {
  return new URL(request.url).searchParams.get(name);
}

function requireQueryParam(request: Request, name: string): { value: string; errorResponse: null } | { value: null; errorResponse: Response } {
  const value = getQueryParam(request, name);
  if (!value) return { value: null, errorResponse: jsonError(request, `Missing required query param: ${name}`, 400) };
  return { value, errorResponse: null };
}

// --- Body parsing ---

async function parseBody<T = Record<string, unknown>>(request: Request): Promise<{ body: T; errorResponse: null } | { body: null; errorResponse: Response }> {
  try {
    const body = (await request.json()) as T;
    return { body, errorResponse: null };
  } catch {
    return { body: null, errorResponse: jsonError(request, "Invalid JSON body", 400) };
  }
}

// --- Wrapper ---

type ApiHandler = (ctx: ActionCtx, request: Request) => Promise<Response>;

/**
 * Wraps an httpAction handler with:
 * - OPTIONS preflight handling
 * - try/catch mapping errors to appropriate status codes
 */
export function apiAction(handler: ApiHandler) {
  return httpAction(async (ctx, request) => {
    if (request.method === "OPTIONS") return optionsResponse(request);
    try {
      return await handler(ctx, request);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      // Map common Convex errors to status codes
      if (message.includes("not found") || message.includes("Not found")) {
        return jsonError(request, message, 404);
      }
      if (message.includes("Not authenticated")) {
        return jsonError(request, message, 401);
      }
      return jsonError(request, message, 400);
    }
  });
}

// --- API Key Auth ---

async function requireApiKeyAuth(
  ctx: ActionCtx,
  request: Request
): Promise<
  | { vaultId: Id<"vaults">; userId: string; errorResponse: null }
  | { vaultId: null; userId: null; errorResponse: Response }
> {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer mk_")) {
    return { vaultId: null, userId: null, errorResponse: jsonError(request, "Unauthorized", 401) };
  }
  const rawKey = authHeader.slice("Bearer ".length);

  // Hash with SHA-256
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const result = await ctx.runQuery(internal.apiKeys.validateKey, { keyHash });
  if (!result) {
    return { vaultId: null, userId: null, errorResponse: jsonError(request, "Unauthorized", 401) };
  }

  // Touch lastUsedAt in background (fire and forget)
  void ctx.runMutation(internal.apiKeys.touchLastUsed, { id: result.keyId });

  return { vaultId: result.vaultId, userId: result.userId, errorResponse: null };
}

type ApiKeyHandler = (
  ctx: ActionCtx,
  request: Request,
  auth: { vaultId: Id<"vaults">; userId: string }
) => Promise<Response>;

/**
 * Wraps an httpAction handler with:
 * - OPTIONS preflight handling
 * - API key authentication (Bearer mk_...)
 * - try/catch mapping errors to appropriate status codes
 */
export function apiKeyAction(handler: ApiKeyHandler) {
  return httpAction(async (ctx, request) => {
    if (request.method === "OPTIONS") return optionsResponse(request);
    try {
      const auth = await requireApiKeyAuth(ctx, request);
      if (auth.errorResponse) return auth.errorResponse;
      return await handler(ctx, request, { vaultId: auth.vaultId, userId: auth.userId });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      if (message.includes("not found") || message.includes("Not found")) {
        return jsonError(request, message, 404);
      }
      return jsonError(request, message, 400);
    }
  });
}

// Re-export utilities for use in handler files
export { jsonOk, jsonError, requireAuth, getQueryParam, requireQueryParam, parseBody };
