import type { Env } from './env';
import { buildAuthContext, enforceApiAuth } from './middleware/api-auth';
import { withCors } from './lib/http';
import { publicWriteErrorMessage } from './lib/dbWriteErrors';
import { AuthError } from './middleware/authorization';
import { handleHealth, handleHealthDb } from './routes/health';
import { handleEmployeeAttendance, handleGetEmployee, handleListEmployees } from './routes/employees';
import { handleGetCase, handleListCases } from './routes/cases';
import { handleListNotifications, handleNotificationSummary } from './routes/notifications';
import {
  handleListAppSettings,
  handleListDepartments,
  handleListDoctors,
  handleListHospitals,
  handleListSurgicalKits,
} from './routes/referenceData';
import {
  handleListAttendanceApprovals,
  handleListAttendanceRecords,
  handleListDailyExpenses,
  handleListFieldTeamAttendance,
  handleListFoodSelections,
  handleListLeaveRequests,
  handleListLocationTrips,
  handleListPetrolRequests,
} from './routes/operationsData';
import {
  handleEmployeeCaseIds,
  handleEmployeeCasesFull,
  handleFcfsPoolCases,
  handleListActivityLog,
  handleListApprovals,
  handleListCaseTaskRequests,
} from './routes/workflowReads';
import { handleStorageDelete, handleStorageStatus, handleStorageUpload } from './routes/storage';
import {
  handleDeleteCase,
  handlePostCase,
  handlePostCaseClaim,
  handlePostCaseSaveSession,
  handlePostCaseSyncHeader,
  handlePutCase,
} from './routes/caseWrites';
import {
  handleDeleteDailyExpense,
  handlePatchAppSetting,
  handlePatchNotificationRead,
  handlePatchSurgicalKit,
  handlePostActivityLog,
  handlePostNotification,
  handlePostNotificationsMarkAllRead,
  handlePutApproval,
  handlePutDailyExpense,
} from './routes/lowRiskWrites';
import {
  handleAuthLogin,
  handleAuthMe,
  handleAuthRequestOtp,
  handleAuthSetPassword,
  handleAuthVerifyOtp,
} from './routes/auth';
import {
  handleTelegramBroadcast,
  handleTelegramNotify,
  handleTelegramWebhook,
} from './routes/telegram';
import {
  handleCaseAlertsAcknowledge,
  handleCaseAlertsProcess,
  handleCaseAlertsStart,
} from './routes/caseAlerts';
import {
  handleBatchDeleteAttendance,
  handleBatchDeleteAttendanceApprovals,
  handleBatchDeleteLeave,
  handlePostFoodSubmitOwn,
  handlePostLeaveSubmitOwn,
  handlePostLinkAuthUser,
  handleDeleteAllPetrol,
  handleDeleteDoctor,
  handleDeleteEmployee,
  handleDeleteHospital,
  handleDeleteLocationTrip,
  handleDeletePetrolRequest,
  handlePatchAttendanceApproval,
  handlePatchAttendanceRecord,
  handlePatchCaseTaskStatus,
  handlePatchFieldTeamAttendance,
  handlePatchLeaveRequest,
  handlePatchLocationTrip,
  handlePatchPetrolRequest,
  handlePostAttendanceApproval,
  handlePostAttendanceRecord,
  handlePostCaseTaskRequest,
  handlePostDoctor,
  handlePostEmployee,
  handlePostFoodAdminSubmit,
  handlePostHospital,
  handlePostLocationTrip,
  handlePostPetrolRequest,
  handlePostResolveCaseTasks,
  handlePutDoctor,
  handlePutEmployee,
  handlePutFieldTeamAttendance,
  handlePutFoodSelection,
  handlePutHospital,
} from './routes/mediumRiskWrites';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'GET' && path === '/health') {
        return withCors(await handleHealth(request, env), env);
      }

      if (request.method === 'GET' && path === '/health/db') {
        return withCors(await handleHealthDb(request, env), env);
      }

      const auth = await buildAuthContext(request, env);

      if (path.startsWith('/api/')) {
        if (request.method === 'POST' && path === '/api/telegram/webhook') {
          return withCors(await handleTelegramWebhook(request, env), env);
        }

        if (request.method === 'POST' && path === '/api/case-alerts/process') {
          return withCors(await handleCaseAlertsProcess(request, env), env);
        }

        const publicAuth =
          (request.method === 'POST' &&
            (path === '/api/auth/login' ||
              path === '/api/auth/request-otp' ||
              path === '/api/auth/verify-otp')) ||
          false;

        if (!publicAuth) {
          const denied = enforceApiAuth(auth, env);
          if (denied) return withCors(denied, env);
        }

        if (request.method === 'POST' && path === '/api/auth/login') {
          return withCors(await handleAuthLogin(request, env), env);
        }
        if (request.method === 'POST' && path === '/api/auth/request-otp') {
          return withCors(await handleAuthRequestOtp(request, env), env);
        }
        if (request.method === 'POST' && path === '/api/auth/verify-otp') {
          return withCors(await handleAuthVerifyOtp(request, env), env);
        }
        if (request.method === 'POST' && path === '/api/auth/set-password') {
          return withCors(await handleAuthSetPassword(request, env, auth), env);
        }
        if (request.method === 'GET' && path === '/api/auth/me') {
          return withCors(await handleAuthMe(env, auth), env);
        }

        if (request.method === 'POST' && path === '/api/telegram/notify') {
          return withCors(await handleTelegramNotify(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/telegram/broadcast') {
          return withCors(await handleTelegramBroadcast(request, env, auth), env);
        }

        if (request.method === 'POST' && path === '/api/case-alerts/start') {
          return withCors(await handleCaseAlertsStart(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/case-alerts/acknowledge') {
          return withCors(await handleCaseAlertsAcknowledge(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/storage/status') {
          return withCors(await handleStorageStatus(request, env), env);
        }

        const storageUploadMatch = path.match(/^\/api\/storage\/([^/]+)\/upload$/);
        if (request.method === 'POST' && storageUploadMatch) {
          return withCors(await handleStorageUpload(request, env, auth, storageUploadMatch[1]), env);
        }

        const storageDeleteMatch = path.match(/^\/api\/storage\/([^/]+)\/objects$/);
        if (request.method === 'DELETE' && storageDeleteMatch) {
          return withCors(await handleStorageDelete(request, env, auth, storageDeleteMatch[1]), env);
        }

        if (request.method === 'GET' && path === '/api/employees') {
          return withCors(await handleListEmployees(request, env, auth), env);
        }

        const empMatch = path.match(/^\/api\/employees\/([^/]+)$/);
        if (request.method === 'GET' && empMatch) {
          return withCors(await handleGetEmployee(request, env, auth, empMatch[1]), env);
        }

        const attMatch = path.match(/^\/api\/employees\/([^/]+)\/attendance$/);
        if (request.method === 'GET' && attMatch) {
          return withCors(await handleEmployeeAttendance(request, env, auth, attMatch[1]), env);
        }

        if (request.method === 'GET' && path === '/api/cases/fcfs-pool') {
          return withCors(await handleFcfsPoolCases(request, env, auth), env);
        }

        const forEmpFullMatch = path.match(/^\/api\/cases\/for-employee\/([^/]+)\/full$/);
        if (request.method === 'GET' && forEmpFullMatch) {
          return withCors(await handleEmployeeCasesFull(request, env, auth, forEmpFullMatch[1]), env);
        }

        const forEmpMatch = path.match(/^\/api\/cases\/for-employee\/([^/]+)$/);
        if (request.method === 'GET' && forEmpMatch) {
          return withCors(await handleEmployeeCaseIds(request, env, auth, forEmpMatch[1]), env);
        }

        if (request.method === 'GET' && path === '/api/cases') {
          return withCors(await handleListCases(request, env, auth), env);
        }

        if (request.method === 'POST' && path === '/api/cases') {
          return withCors(await handlePostCase(request, env, auth), env);
        }

        const caseMatch = path.match(/^\/api\/cases\/([^/]+)$/);
        if (request.method === 'GET' && caseMatch) {
          return withCors(await handleGetCase(request, env, auth, caseMatch[1]), env);
        }
        if (request.method === 'PUT' && caseMatch) {
          return withCors(await handlePutCase(request, env, auth, caseMatch[1]), env);
        }
        if (request.method === 'DELETE' && caseMatch) {
          return withCors(await handleDeleteCase(request, env, auth, caseMatch[1]), env);
        }

        const caseSaveMatch = path.match(/^\/api\/cases\/([^/]+)\/save-session$/);
        if (request.method === 'POST' && caseSaveMatch) {
          return withCors(await handlePostCaseSaveSession(request, env, auth, caseSaveMatch[1]), env);
        }

        const caseSyncMatch = path.match(/^\/api\/cases\/([^/]+)\/sync-header$/);
        if (request.method === 'POST' && caseSyncMatch) {
          return withCors(await handlePostCaseSyncHeader(request, env, auth, caseSyncMatch[1]), env);
        }

        const caseClaimMatch = path.match(/^\/api\/cases\/([^/]+)\/claim$/);
        if (request.method === 'POST' && caseClaimMatch) {
          return withCors(await handlePostCaseClaim(request, env, auth, caseClaimMatch[1]), env);
        }

        if (request.method === 'GET' && path === '/api/notifications/summary') {
          return withCors(await handleNotificationSummary(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/notifications') {
          return withCors(await handleListNotifications(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/hospitals') {
          return withCors(await handleListHospitals(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/doctors') {
          return withCors(await handleListDoctors(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/departments') {
          return withCors(await handleListDepartments(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/surgical-kits') {
          return withCors(await handleListSurgicalKits(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/settings') {
          return withCors(await handleListAppSettings(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/attendance-records') {
          return withCors(await handleListAttendanceRecords(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/attendance-approval-requests') {
          return withCors(await handleListAttendanceApprovals(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/field-team-attendance') {
          return withCors(await handleListFieldTeamAttendance(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/leave-requests') {
          return withCors(await handleListLeaveRequests(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/petrol-requests') {
          return withCors(await handleListPetrolRequests(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/location-trips') {
          return withCors(await handleListLocationTrips(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/food-selections') {
          return withCors(await handleListFoodSelections(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/daily-expenses') {
          return withCors(await handleListDailyExpenses(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/approvals') {
          return withCors(await handleListApprovals(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/case-task-requests') {
          return withCors(await handleListCaseTaskRequests(request, env, auth), env);
        }

        if (request.method === 'GET' && path === '/api/activity-log') {
          return withCors(await handleListActivityLog(request, env, auth), env);
        }

        if (request.method === 'POST' && path === '/api/activity-log') {
          return withCors(await handlePostActivityLog(request, env, auth), env);
        }

        if (request.method === 'POST' && path === '/api/notifications') {
          return withCors(await handlePostNotification(request, env, auth), env);
        }

        if (request.method === 'POST' && path === '/api/notifications/mark-all-read') {
          return withCors(await handlePostNotificationsMarkAllRead(request, env, auth), env);
        }

        const notifReadMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
        if (request.method === 'PATCH' && notifReadMatch) {
          return withCors(
            await handlePatchNotificationRead(request, env, auth, notifReadMatch[1]),
            env,
          );
        }

        const settingsMatch = path.match(/^\/api\/settings\/([^/]+)$/);
        if (request.method === 'PATCH' && settingsMatch) {
          return withCors(await handlePatchAppSetting(request, env, auth, settingsMatch[1]), env);
        }

        const kitMatch = path.match(/^\/api\/surgical-kits\/([^/]+)$/);
        if (request.method === 'PATCH' && kitMatch) {
          return withCors(await handlePatchSurgicalKit(request, env, auth, kitMatch[1]), env);
        }

        const expenseMatch = path.match(/^\/api\/daily-expenses\/([^/]+)$/);
        if (request.method === 'PUT' && expenseMatch) {
          return withCors(await handlePutDailyExpense(request, env, auth, expenseMatch[1]), env);
        }
        if (request.method === 'DELETE' && expenseMatch) {
          return withCors(await handleDeleteDailyExpense(request, env, auth, expenseMatch[1]), env);
        }

        const approvalMatch = path.match(/^\/api\/approvals\/([^/]+)$/);
        if (request.method === 'PUT' && approvalMatch) {
          return withCors(await handlePutApproval(request, env, auth, approvalMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/employees') {
          return withCors(await handlePostEmployee(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/employees/link-auth') {
          return withCors(await handlePostLinkAuthUser(request, env, auth), env);
        }
        const empWriteMatch = path.match(/^\/api\/employees\/([^/]+)$/);
        if (request.method === 'PUT' && empWriteMatch) {
          return withCors(await handlePutEmployee(request, env, auth, empWriteMatch[1]), env);
        }
        if (request.method === 'DELETE' && empWriteMatch) {
          return withCors(await handleDeleteEmployee(request, env, auth, empWriteMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/hospitals') {
          return withCors(await handlePostHospital(request, env, auth), env);
        }
        const hospWriteMatch = path.match(/^\/api\/hospitals\/([^/]+)$/);
        if (request.method === 'PUT' && hospWriteMatch) {
          return withCors(await handlePutHospital(request, env, auth, hospWriteMatch[1]), env);
        }
        if (request.method === 'DELETE' && hospWriteMatch) {
          return withCors(await handleDeleteHospital(request, env, auth, hospWriteMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/doctors') {
          return withCors(await handlePostDoctor(request, env, auth), env);
        }
        const docWriteMatch = path.match(/^\/api\/doctors\/([^/]+)$/);
        if (request.method === 'PUT' && docWriteMatch) {
          return withCors(await handlePutDoctor(request, env, auth, docWriteMatch[1]), env);
        }
        if (request.method === 'DELETE' && docWriteMatch) {
          return withCors(await handleDeleteDoctor(request, env, auth, docWriteMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/attendance-records') {
          return withCors(await handlePostAttendanceRecord(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/attendance-records/batch-delete') {
          return withCors(await handleBatchDeleteAttendance(request, env, auth), env);
        }
        const attWriteMatch = path.match(/^\/api\/attendance-records\/([^/]+)$/);
        if (request.method === 'PATCH' && attWriteMatch) {
          return withCors(await handlePatchAttendanceRecord(request, env, auth, attWriteMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/attendance-approval-requests') {
          return withCors(await handlePostAttendanceApproval(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/attendance-approval-requests/batch-delete') {
          return withCors(await handleBatchDeleteAttendanceApprovals(request, env, auth), env);
        }
        const attApprMatch = path.match(/^\/api\/attendance-approval-requests\/([^/]+)$/);
        if (request.method === 'PATCH' && attApprMatch) {
          return withCors(await handlePatchAttendanceApproval(request, env, auth, attApprMatch[1]), env);
        }

        if (request.method === 'PUT' && path === '/api/field-team-attendance') {
          return withCors(await handlePutFieldTeamAttendance(request, env, auth), env);
        }
        const ftMatch = path.match(/^\/api\/field-team-attendance\/([^/]+)$/);
        if (request.method === 'PATCH' && ftMatch) {
          return withCors(await handlePatchFieldTeamAttendance(request, env, auth, ftMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/leave-requests/batch-delete') {
          return withCors(await handleBatchDeleteLeave(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/leave-requests/submit-own') {
          return withCors(await handlePostLeaveSubmitOwn(request, env, auth), env);
        }
        const leaveMatch = path.match(/^\/api\/leave-requests\/([^/]+)$/);
        if (request.method === 'PATCH' && leaveMatch) {
          return withCors(await handlePatchLeaveRequest(request, env, auth, leaveMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/food-selections/admin-submit') {
          return withCors(await handlePostFoodAdminSubmit(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/food-selections/submit-own') {
          return withCors(await handlePostFoodSubmitOwn(request, env, auth), env);
        }
        const foodMatch = path.match(/^\/api\/food-selections\/([^/]+)$/);
        if (request.method === 'PUT' && foodMatch) {
          return withCors(await handlePutFoodSelection(request, env, auth, foodMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/petrol-requests') {
          return withCors(await handlePostPetrolRequest(request, env, auth), env);
        }
        if (request.method === 'DELETE' && path === '/api/petrol-requests') {
          return withCors(await handleDeleteAllPetrol(request, env, auth), env);
        }
        const petrolMatch = path.match(/^\/api\/petrol-requests\/([^/]+)$/);
        if (request.method === 'PATCH' && petrolMatch) {
          return withCors(await handlePatchPetrolRequest(request, env, auth, petrolMatch[1]), env);
        }
        if (request.method === 'DELETE' && petrolMatch) {
          return withCors(await handleDeletePetrolRequest(request, env, auth, petrolMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/location-trips') {
          return withCors(await handlePostLocationTrip(request, env, auth), env);
        }
        const tripMatch = path.match(/^\/api\/location-trips\/([^/]+)$/);
        if (request.method === 'PATCH' && tripMatch) {
          return withCors(await handlePatchLocationTrip(request, env, auth, tripMatch[1]), env);
        }
        if (request.method === 'DELETE' && tripMatch) {
          return withCors(await handleDeleteLocationTrip(request, env, auth, tripMatch[1]), env);
        }

        if (request.method === 'POST' && path === '/api/case-task-requests') {
          return withCors(await handlePostCaseTaskRequest(request, env, auth), env);
        }
        if (request.method === 'POST' && path === '/api/case-task-requests/resolve-pending') {
          return withCors(await handlePostResolveCaseTasks(request, env, auth), env);
        }
        const ctStatusMatch = path.match(/^\/api\/case-task-requests\/([^/]+)\/status$/);
        if (request.method === 'PATCH' && ctStatusMatch) {
          return withCors(await handlePatchCaseTaskStatus(request, env, auth, ctStatusMatch[1]), env);
        }

        return withCors(
          new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
        );
      }

      return withCors(
        new Response(
          JSON.stringify({
            ok: false,
            message: 'Malcon Nexus Worker API — Phase 7 local routes only. SPA still uses Supabase.',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
        env,
      );
    } catch (e) {
      const message = publicWriteErrorMessage(e);
      const status = e instanceof AuthError ? e.status : 500;
      const code =
        status === 503
          ? 'UNAVAILABLE'
          : status === 401
            ? 'UNAUTHORIZED'
            : status === 403
              ? 'FORBIDDEN'
              : 'INTERNAL';
      return withCors(
        new Response(JSON.stringify({ error: { code, message } }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
      );
    }
}
