/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dataMutations from "../dataMutations.js";
import type * as dataQueries from "../dataQueries.js";
import type * as http from "../http.js";
import type * as lib_authContext from "../lib/authContext.js";
import type * as lib_googleDrive from "../lib/googleDrive.js";
import type * as lib_httpUtil from "../lib/httpUtil.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as lib_rows from "../lib/rows.js";
import type * as lib_stagePhotoAuth from "../lib/stagePhotoAuth.js";
import type * as lib_stagePhotosHttp from "../lib/stagePhotosHttp.js";
import type * as migration from "../migration.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dataMutations: typeof dataMutations;
  dataQueries: typeof dataQueries;
  http: typeof http;
  "lib/authContext": typeof lib_authContext;
  "lib/googleDrive": typeof lib_googleDrive;
  "lib/httpUtil": typeof lib_httpUtil;
  "lib/jwt": typeof lib_jwt;
  "lib/rows": typeof lib_rows;
  "lib/stagePhotoAuth": typeof lib_stagePhotoAuth;
  "lib/stagePhotosHttp": typeof lib_stagePhotosHttp;
  migration: typeof migration;
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
