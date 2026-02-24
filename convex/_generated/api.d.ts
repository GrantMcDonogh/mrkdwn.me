/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiFolders from "../apiFolders.js";
import type * as apiHelpers from "../apiHelpers.js";
import type * as apiKeys from "../apiKeys.js";
import type * as apiNotes from "../apiNotes.js";
import type * as apiVaults from "../apiVaults.js";
import type * as chat from "../chat.js";
import type * as chatEdit from "../chatEdit.js";
import type * as chatEditHelpers from "../chatEditHelpers.js";
import type * as chatHelpers from "../chatHelpers.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as importVault from "../importVault.js";
import type * as internalApi from "../internalApi.js";
import type * as notes from "../notes.js";
import type * as onboarding from "../onboarding.js";
import type * as testKey from "../testKey.js";
import type * as userSettings from "../userSettings.js";
import type * as vaults from "../vaults.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiFolders: typeof apiFolders;
  apiHelpers: typeof apiHelpers;
  apiKeys: typeof apiKeys;
  apiNotes: typeof apiNotes;
  apiVaults: typeof apiVaults;
  chat: typeof chat;
  chatEdit: typeof chatEdit;
  chatEditHelpers: typeof chatEditHelpers;
  chatHelpers: typeof chatHelpers;
  folders: typeof folders;
  http: typeof http;
  importVault: typeof importVault;
  internalApi: typeof internalApi;
  notes: typeof notes;
  onboarding: typeof onboarding;
  testKey: typeof testKey;
  userSettings: typeof userSettings;
  vaults: typeof vaults;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
