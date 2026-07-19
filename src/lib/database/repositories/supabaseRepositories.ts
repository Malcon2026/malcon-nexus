// src/lib/database/repositories/supabaseRepositories.ts
//
// Direct Supabase SDK repositories — used when VITE_SUPABASE_URL is configured.
// Each function maps between the app's camelCase TypeScript types and the
// Supabase snake_case database columns.

import { supabase } from '../../supabase';
import type {
  Employee, Hospital, Doctor, ImplantCase,
  Notification, Approval, DepartmentInfo, SurgicalKit, ActivityEvent, AttendanceRecord,
  AttendanceApprovalRequest,
  LeaveRequest,
} from '../../../types';
import { normalizeWorkflowStage } from '../../../utils/helpers';

// ─── HELPERS ─────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

function snakeToCamel<T>(obj: Record<string, unknown>): T {
  const convert = (str: string) =>
    str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [convert(k), v])
  ) as T;
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const convert = (str: string) =>
    str.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [convert(k), v])
  );
}

// ─── EMPLOYEES ───────────────────────────────────────────────

export const sbEmployeeRepo = {
  async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase.from('employees').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department as Employee['department'],
      role: row.role as Employee['role'],
      status: row.status as Employee['status'],
      avatar: row.avatar,
      phone: row.phone,
      casesCompleted: row.cases_completed,
      casesActive: row.cases_active,
      joinDate: row.join_date,
    }));
  },

  async getById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      department: data.department as Employee['department'],
      role: data.role as Employee['role'],
      status: data.status as Employee['status'],
      avatar: data.avatar,
      phone: data.phone,
      casesCompleted: data.cases_completed,
      casesActive: data.cases_active,
      joinDate: data.join_date,
    };
  },

  async getByEmail(email: string): Promise<Employee | null> {
    const { data, error } = await supabase.from('employees').select('*').eq('email', email).single();
    if (error || !data) return null;
    return this.getById(data.id);
  },

  async create(e: Employee): Promise<Employee> {
    const { error } = await supabase.from('employees').insert({
      id: e.id,
      name: e.name,
      email: e.email,
      department: e.department,
      role: e.role,
      status: e.status,
      avatar: e.avatar,
      phone: e.phone,
      cases_completed: e.casesCompleted,
      cases_active: e.casesActive,
      join_date: e.joinDate,
    });
    if (error) throw error;
    return e;
  },

  async update(id: string, updates: Partial<Employee>): Promise<Employee> {
    const patch: Record<string, unknown> = {};
    if (updates.name)           patch.name = updates.name;
    if (updates.email)          patch.email = updates.email;
    if (updates.department)     patch.department = updates.department;
    if (updates.role)           patch.role = updates.role;
    if (updates.status)         patch.status = updates.status;
    if (updates.avatar)         patch.avatar = updates.avatar;
    if (updates.phone)          patch.phone = updates.phone;
    if (updates.casesCompleted !== undefined) patch.cases_completed = updates.casesCompleted;
    if (updates.casesActive !== undefined)    patch.cases_active = updates.casesActive;
    if (updates.joinDate)       patch.join_date = updates.joinDate;

    const { data, error } = await supabase.from('employees').update(patch).eq('id', id).select().single();
    if (error || !data) throw error ?? new Error('Employee not found');
    return (await this.getById(id))!;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
  },

  async linkAuthUser(employeeId: string, authUserId: string): Promise<void> {
    const { error } = await supabase.from('employees').update({ auth_user_id: authUserId }).eq('id', employeeId);
    if (error) throw error;
  },
};


// ─── HOSPITALS ───────────────────────────────────────────────

export const sbHospitalRepo = {
  async getAll(): Promise<Hospital[]> {
    const { data, error } = await supabase.from('hospitals').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      branch: row.branch ?? '',
      address: row.address,
      city: row.city,
      contactPerson: row.contact_person,
      phone: row.phone,
      email: row.email,
      status: row.status as Hospital['status'],
    }));
  },

  async create(h: Hospital): Promise<Hospital> {
    const base = {
      id: h.id,
      name: h.name,
      address: h.address,
      city: h.city,
      contact_person: h.contactPerson,
      phone: h.phone,
      email: h.email,
      status: h.status,
    };

    let { error } = await supabase.from('hospitals').insert({ ...base, branch: h.branch ?? '' });
    if (error?.message?.includes('branch')) {
      ({ error } = await supabase.from('hospitals').insert(base));
    }
    if (error) throw error;
    return h;
  },

  async update(id: string, u: Partial<Hospital>): Promise<Hospital> {
    const patch: Record<string, unknown> = {};
    if (u.name)          patch.name = u.name;
    if (u.branch !== undefined) patch.branch = u.branch;
    if (u.address !== undefined)       patch.address = u.address;
    if (u.city)          patch.city = u.city;
    if (u.contactPerson !== undefined) patch.contact_person = u.contactPerson;
    if (u.phone !== undefined)         patch.phone = u.phone;
    if (u.email !== undefined)         patch.email = u.email;
    if (u.status)        patch.status = u.status;

    let { error } = await supabase.from('hospitals').update(patch).eq('id', id);
    if (error?.message?.includes('branch') && 'branch' in patch) {
      const { branch: _b, ...withoutBranch } = patch;
      ({ error } = await supabase.from('hospitals').update(withoutBranch).eq('id', id));
    }
    if (error) throw error;
    const all = await this.getAll();
    return all.find((h) => h.id === id)!;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) throw error;
  },
};


// ─── DOCTORS ─────────────────────────────────────────────────

export const sbDoctorRepo = {
  async getAll(): Promise<Doctor[]> {
    const { data, error } = await supabase.from('doctors').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      specialization: row.specialization,
      hospitalId: row.hospital_id ?? '',
      phone: row.phone,
    }));
  },

  async create(d: Doctor): Promise<Doctor> {
    const { error } = await supabase.from('doctors').insert({
      id: d.id,
      name: d.name,
      specialization: d.specialization,
      hospital_id: d.hospitalId || null,
      phone: d.phone,
    });
    if (error) throw error;
    return d;
  },

  async update(id: string, u: Partial<Doctor>): Promise<Doctor> {
    const patch: Record<string, unknown> = {};
    if (u.name)           patch.name = u.name;
    if (u.specialization) patch.specialization = u.specialization;
    if (u.hospitalId)     patch.hospital_id = u.hospitalId;
    if (u.phone)          patch.phone = u.phone;

    const { error } = await supabase.from('doctors').update(patch).eq('id', id);
    if (error) throw error;
    const all = await this.getAll();
    return all.find((d) => d.id === id)!;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) throw error;
  },
};


// ─── CASES ───────────────────────────────────────────────────

const FALLBACK_HOSPITAL: Hospital = {
  id: 'unknown',
  name: 'Unknown Hospital',
  branch: '',
  address: '',
  city: '',
  contactPerson: '',
  phone: '',
  email: '',
  status: 'Active',
};

function rowToCase(row: Record<string, unknown>): ImplantCase {
  return {
    id: row.id as string,
    caseNumber: row.case_number as string,
    hospital: (row.hospital_snapshot as ImplantCase['hospital']) ?? FALLBACK_HOSPITAL,
    doctor: (row.doctor_snapshot as ImplantCase['doctor']) ?? {
      id: '',
      name: 'Unknown Doctor',
      specialization: '',
      hospitalId: '',
      phone: '',
    },
    surgeryDate: (row.surgery_date as string) ?? '',
    implantRequired: (row.implant_required as string) ?? '',
    implantType: (row.implant_type as string) ?? '',
    priority: row.priority as ImplantCase['priority'],
    status: row.status as ImplantCase['status'],
    currentStage: normalizeWorkflowStage(row.current_stage as string),
    currentDepartment: row.current_department as ImplantCase['currentDepartment'],
    assignedEmployee: (row.assigned_employee_snapshot as ImplantCase['assignedEmployee']) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    dueDate: row.due_date as string,
    remarks: row.remarks as string,
    stages: (row.stages as ImplantCase['stages']) ?? [],
    activityLogs: (row.activity_logs as ImplantCase['activityLogs']) ?? [],
    comments: (row.comments as ImplantCase['comments']) ?? [],
    invoiceAmount: row.invoice_amount as number | undefined,
    collectedAmount: row.collected_amount as number | undefined,
    paymentStatus: row.payment_status as ImplantCase['paymentStatus'],
  };
}

function caseToRow(c: ImplantCase): Record<string, unknown> {
  return {
    id: c.id,
    case_number: c.caseNumber,
    hospital_id: asUuid(c.hospital.id),
    doctor_id: asUuid(c.doctor?.id),
    hospital_snapshot: c.hospital,
    doctor_snapshot: c.doctor ?? {},
    surgery_date: c.surgeryDate || null,
    implant_required: c.implantRequired,
    implant_type: c.implantType,
    priority: c.priority,
    status: c.status,
    current_stage: c.currentStage,
    current_department: c.currentDepartment ?? null,
    assigned_employee_id: asUuid(c.assignedEmployee?.id),
    assigned_employee_snapshot: c.assignedEmployee ?? null,
    created_by: c.createdBy,
    due_date: c.dueDate || null,
    remarks: c.remarks,
    stages: c.stages,
    activity_logs: c.activityLogs,
    comments: c.comments,
    invoice_amount: c.invoiceAmount ?? null,
    collected_amount: c.collectedAmount ?? null,
    payment_status: c.paymentStatus ?? null,
  };
}

export const sbCaseRepo = {
  async getNextCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `IMP-${year}-`;
    const { data, error } = await supabase
      .from('cases')
      .select('case_number')
      .like('case_number', `${prefix}%`);
    if (error) throw error;
    let max = 0;
    for (const row of data ?? []) {
      const num = parseInt(String(row.case_number).slice(prefix.length), 10);
      if (!isNaN(num)) max = Math.max(max, num);
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  },

  async getAll(): Promise<ImplantCase[]> {
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => rowToCase(row as Record<string, unknown>));
  },

  async getById(id: string): Promise<ImplantCase | null> {
    const { data, error } = await supabase.from('cases').select('*').eq('id', id).single();
    if (error || !data) return null;
    return rowToCase(data as Record<string, unknown>);
  },

  async create(c: ImplantCase): Promise<ImplantCase> {
    const row = caseToRow(c);
    if (!row.hospital_id) {
      throw new Error('Hospital must be saved in the database before creating a case. Re-add the hospital and try again.');
    }
    const { error } = await supabase.from('cases').insert(caseToRow(c) as never);
    if (error) throw error;
    return c;
  },

  async update(id: string, updates: Partial<ImplantCase>): Promise<ImplantCase> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Case ${id} not found`);
    const merged = { ...existing, ...updates };
    const { error } = await supabase.from('cases').update(caseToRow(merged) as never).eq('id', id);
    if (error) throw error;
    return merged;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('cases').delete().eq('id', id);
    if (error) throw error;
  },

  async saveAll(cases: ImplantCase[]): Promise<void> {
    // Used by useStore's bulk-save pattern
    for (const c of cases) {
      await this.update(c.id, c).catch(() => this.create(c));
    }
  },
};


// ─── NOTIFICATIONS ───────────────────────────────────────────

export const sbNotificationRepo = {
  async getAll(recipientId?: string): Promise<Notification[]> {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (recipientId) query = query.eq('recipient_id', recipientId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type as Notification['type'],
      timestamp: row.created_at,
      read: row.is_read,
      caseId: row.case_id ?? undefined,
    }));
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  },

  async markAllRead(recipientId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', recipientId).eq('is_read', false);
    if (error) throw error;
  },

  async create(n: Notification & { recipientId?: string }): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      is_read: n.read,
      case_id: n.caseId ?? null,
      recipient_id: n.recipientId ?? null,
    });
    if (error) throw error;
  },
};


// ─── APPROVALS ───────────────────────────────────────────────

export const sbApprovalRepo = {
  async getAll(): Promise<Approval[]> {
    const { data, error } = await supabase.from('approvals').select('*').order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => snakeToCamel<Approval>(row as Record<string, unknown>));
  },

  async upsert(a: Approval): Promise<void> {
    const { error } = await supabase.from('approvals').upsert({
      id: a.id,
      case_id: a.caseId,
      case_number: a.caseNumber,
      stage: a.stage,
      submitted_by: a.submittedBy,
      submitted_at: a.submittedAt,
      approved_at: a.approvedAt ?? null,
      status: a.status,
      notes: a.notes ?? null,
      admin_notes: a.adminNotes ?? null,
    }, { onConflict: 'id' });
    if (error) throw error;
  },
};


// ─── ACTIVITY LOG ────────────────────────────────────────────

export const sbActivityRepo = {
  async getAll(): Promise<ActivityEvent[]> {
    const { data, error } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type as ActivityEvent['entityType'],
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      performedBy: row.performed_by,
      performedByRole: row.performed_by_role as ActivityEvent['performedByRole'],
      timestamp: row.created_at,
      details: row.details,
    }));
  },

  async insert(e: ActivityEvent): Promise<void> {
    const { error } = await supabase.from('activity_log').insert({
      id: e.id,
      action: e.action,
      entity_type: e.entityType,
      entity_id: e.entityId,
      entity_label: e.entityLabel,
      performed_by: e.performedBy,
      performed_by_role: e.performedByRole,
      details: e.details,
    });
    if (error) throw error;
  },
};


// ─── ATTENDANCE ──────────────────────────────────────────────

export const sbAttendanceRepo = {
  async getAll(): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('punched_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      punchType: row.punch_type as AttendanceRecord['punchType'],
      punchedAt: row.punched_at,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyM: row.accuracy_m,
      distanceM: row.distance_m,
      withinOffice: row.within_office,
      officeAddress: row.office_address,
    }));
  },

  async insert(record: AttendanceRecord): Promise<void> {
    const { error } = await supabase.from('attendance_records').insert({
      id: record.id,
      employee_id: record.employeeId,
      employee_name: record.employeeName,
      punch_type: record.punchType,
      punched_at: record.punchedAt,
      latitude: record.latitude,
      longitude: record.longitude,
      accuracy_m: record.accuracyM,
      distance_m: record.distanceM,
      within_office: record.withinOffice,
      office_address: record.officeAddress,
    });
    if (error) throw error;
  },
};


// ─── ATTENDANCE APPROVAL REQUESTS ────────────────────────────

export const sbAttendanceApprovalRepo = {
  async getAll(): Promise<AttendanceApprovalRequest[]> {
    const { data, error } = await supabase
      .from('attendance_approval_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      punchType: row.punch_type as AttendanceApprovalRequest['punchType'],
      requestedAt: row.requested_at,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyM: row.accuracy_m,
      distanceM: row.distance_m,
      reason: row.reason,
      status: row.status as AttendanceApprovalRequest['status'],
      reviewedBy: row.reviewed_by,
      reviewedById: row.reviewed_by_id,
      reviewedAt: row.reviewed_at,
      adminNotes: row.admin_notes ?? '',
      attendanceRecordId: row.attendance_record_id,
    }));
  },

  async insert(request: AttendanceApprovalRequest): Promise<void> {
    const { error } = await supabase.from('attendance_approval_requests').insert({
      id: request.id,
      employee_id: request.employeeId,
      employee_name: request.employeeName,
      punch_type: request.punchType,
      requested_at: request.requestedAt,
      latitude: request.latitude,
      longitude: request.longitude,
      accuracy_m: request.accuracyM,
      distance_m: request.distanceM,
      reason: request.reason,
      status: request.status,
      reviewed_by: request.reviewedBy,
      reviewed_by_id: request.reviewedById,
      reviewed_at: request.reviewedAt,
      admin_notes: request.adminNotes,
      attendance_record_id: request.attendanceRecordId,
    });
    if (error) throw error;
  },

  async update(id: string, updates: Partial<AttendanceApprovalRequest>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.reviewedBy !== undefined) payload.reviewed_by = updates.reviewedBy;
    if (updates.reviewedById !== undefined) payload.reviewed_by_id = updates.reviewedById;
    if (updates.reviewedAt !== undefined) payload.reviewed_at = updates.reviewedAt;
    if (updates.adminNotes !== undefined) payload.admin_notes = updates.adminNotes;
    if (updates.attendanceRecordId !== undefined) payload.attendance_record_id = updates.attendanceRecordId;

    const { error } = await supabase
      .from('attendance_approval_requests')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  },
};


// ─── LEAVE REQUESTS ──────────────────────────────────────────

export const sbLeaveRepo = {
  async getAll(): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      leaveType: row.leave_type as LeaveRequest['leaveType'],
      fromDate: row.from_date,
      toDate: row.to_date,
      reason: row.reason,
      status: row.status as LeaveRequest['status'],
      reviewedBy: row.reviewed_by,
      reviewedById: row.reviewed_by_id,
      reviewedAt: row.reviewed_at,
      adminNotes: row.admin_notes ?? '',
      createdAt: row.created_at,
    }));
  },

  async insert(request: LeaveRequest): Promise<void> {
    const { error } = await supabase.from('leave_requests').insert({
      id: request.id,
      employee_id: request.employeeId,
      employee_name: request.employeeName,
      leave_type: request.leaveType,
      from_date: request.fromDate,
      to_date: request.toDate,
      reason: request.reason,
      status: request.status,
      reviewed_by: request.reviewedBy,
      reviewed_by_id: request.reviewedById,
      reviewed_at: request.reviewedAt,
      admin_notes: request.adminNotes,
      created_at: request.createdAt,
    });
    if (error) throw error;
  },

  async update(id: string, updates: Partial<LeaveRequest>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.reviewedBy !== undefined) payload.reviewed_by = updates.reviewedBy;
    if (updates.reviewedById !== undefined) payload.reviewed_by_id = updates.reviewedById;
    if (updates.reviewedAt !== undefined) payload.reviewed_at = updates.reviewedAt;
    if (updates.adminNotes !== undefined) payload.admin_notes = updates.adminNotes;

    const { error } = await supabase.from('leave_requests').update(payload).eq('id', id);
    if (error) throw error;
  },
};


// ─── DEPARTMENTS ─────────────────────────────────────────────

export const sbDepartmentRepo = {
  async getAll(): Promise<DepartmentInfo[]> {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name as DepartmentInfo['name'],
      description: row.description,
      color: row.color,
    }));
  },
};


// ─── SURGICAL KITS ───────────────────────────────────────────

export const sbKitRepo = {
  async getAll(): Promise<SurgicalKit[]> {
    const { data, error } = await supabase.from('surgical_kits').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      serialNumber: row.serial_number,
      status: row.status as SurgicalKit['status'],
      lastUsedDate: row.last_used_date ?? undefined,
    }));
  },

  async update(id: string, updates: Partial<SurgicalKit>): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (updates.status)       patch.status = updates.status;
    if (updates.lastUsedDate) patch.last_used_date = updates.lastUsedDate;
    const { error } = await supabase.from('surgical_kits').update(patch).eq('id', id);
    if (error) throw error;
  },
};
