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
import type * as lib_alertMessages from "../lib/alertMessages.js";
import type * as lib_authContext from "../lib/authContext.js";
import type * as lib_caseAlertEscalations from "../lib/caseAlertEscalations.js";
import type * as lib_caseAlertsHttp from "../lib/caseAlertsHttp.js";
import type * as lib_caseNumber from "../lib/caseNumber.js";
import type * as lib_googleDrive from "../lib/googleDrive.js";
import type * as lib_httpAuthHelpers from "../lib/httpAuthHelpers.js";
import type * as lib_httpUtil from "../lib/httpUtil.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as lib_loginOtp from "../lib/loginOtp.js";
import type * as lib_rows from "../lib/rows.js";
import type * as lib_stagePhotoAuth from "../lib/stagePhotoAuth.js";
import type * as lib_stagePhotosHttp from "../lib/stagePhotosHttp.js";
import type * as lib_telegramApi from "../lib/telegramApi.js";
import type * as lib_telegramHttp from "../lib/telegramHttp.js";
import type * as lib_telegramService from "../lib/telegramService.js";
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
  "lib/alertMessages": typeof lib_alertMessages;
  "lib/authContext": typeof lib_authContext;
  "lib/caseAlertEscalations": typeof lib_caseAlertEscalations;
  "lib/caseAlertsHttp": typeof lib_caseAlertsHttp;
  "lib/caseNumber": typeof lib_caseNumber;
  "lib/googleDrive": typeof lib_googleDrive;
  "lib/httpAuthHelpers": typeof lib_httpAuthHelpers;
  "lib/httpUtil": typeof lib_httpUtil;
  "lib/jwt": typeof lib_jwt;
  "lib/loginOtp": typeof lib_loginOtp;
  "lib/rows": typeof lib_rows;
  "lib/stagePhotoAuth": typeof lib_stagePhotoAuth;
  "lib/stagePhotosHttp": typeof lib_stagePhotosHttp;
  "lib/telegramApi": typeof lib_telegramApi;
  "lib/telegramHttp": typeof lib_telegramHttp;
  "lib/telegramService": typeof lib_telegramService;
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
