import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp, CheckCircle2, Clock, Mail, Phone, Plus, Trash2, Edit3, Upload } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import { departmentColors } from '../utils/helpers';
import type { Department, Employee } from '../types';
import { EmployeeCsvImportModal } from '../components/EmployeeCsvImportModal';

const DEPARTMENTS: (Department | 'All')[] = [
  'All', 'Stores', 'Delivery', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission'
];

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const emptyForm = {
  name: '',
  department: 'Stores' as Department,
  email: '',
  phone: '',
  role: 'employee' as 'admin' | 'employee',
};

export const Employees: React.FC = () => {
  const { employees, viewMode, createEmployee, updateEmployee, deleteEmployee } = useStore();
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [showModal, setShowModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setForm({
      name: emp.name,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
    });
    setEditingEmployee(emp);
    setShowModal(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.department) {
      alert('Please fill in all required fields marked with an asterisk (*).');
      return;
    }

    if (editingEmployee) {
      const { error } = await updateEmployee(editingEmployee.id, {
        name: form.name,
        department: form.department,
        email: form.email,
        phone: form.phone,
        role: form.role,
        avatar: form.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
      });
      if (error) {
        alert(error);
        return;
      }
    } else {
      createEmployee({
        name: form.name,
        department: form.department,
        email: form.email,
        phone: form.phone,
        role: form.role,
      });
    }

    setShowModal(false);
    setForm(emptyForm);
    setEditingEmployee(null);
  };

  const filtered = employees
    .filter(e => e.role === 'employee')
    .filter(e => filterDept === 'All' || e.department === filterDept)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()));

  const deptStats = DEPARTMENTS.slice(1).map(dept => ({
    dept,
    employees: employees.filter(e => e.department === dept),
    active: employees.filter(e => e.department === dept && e.casesActive > 0).length,
    completed: employees.filter(e => e.department === dept).reduce((s, e) => s + e.casesCompleted, 0),
  }));

  const maxCompleted = Math.max(1, ...employees.map(e => e.casesCompleted));

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full min-w-0">
      <EmployeeCsvImportModal isOpen={showCsvModal} onClose={() => setShowCsvModal(false)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage team members across all departments</p>
        </div>
        {viewMode === 'admin' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => setShowCsvModal(true)}
            >
              Import CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleOpenCreate}
            >
              Add Employee
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {deptStats.map(({ dept, employees: emps, active, completed }) => (
          <Card key={dept as string} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterDept(dept as Department)}>
            <p className="text-xs font-semibold text-gray-900 truncate">{dept}</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{emps.length}</p>
                <p className="text-[10px] text-gray-400">employees</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-indigo-600">{active} active</p>
                <p className="text-[10px] text-gray-400">{completed} done</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              onClick={() => setFilterDept(dept as Department | 'All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterDept === dept ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp, idx) => (
          <motion.div
            key={emp.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <Card hover>
              <CardBody>
                <div className="flex items-start gap-4">
                  <Avatar name={emp.name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-grow mr-2">
                        <p className="text-sm font-bold text-gray-900 truncate" title={emp.name}>{emp.name}</p>
                        <Badge className={`${departmentColors[emp.department]} text-[10px] mt-1`}>{emp.department}</Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${emp.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-300'}`} title={emp.status} />
                        {viewMode === 'admin' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="p-1 rounded-md text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Edit Employee"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete employee ${emp.name}?`)) {
                                  deleteEmployee(emp.id);
                                }
                              }}
                              className="p-1 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete Employee"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-[10px]">Completed</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{emp.casesCompleted}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px]">Active</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{emp.casesActive}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {emp.phone}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                        <TrendingUp className="h-3 w-3" />
                        <span>Performance</span>
                      </div>
                      <div className="h-1.5 w-32 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (emp.casesCompleted / maxCompleted) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">Joined {new Date(emp.joinDate).getFullYear()}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingEmployee(null); }}
          title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
          subtitle={editingEmployee ? 'Update employee details' : 'Register a new team member and assign their department'}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => { setShowModal(false); setEditingEmployee(null); }}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => handleSubmit()}>
                {editingEmployee ? 'Save Changes' : 'Add Employee'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Full Name *</label>
              <input
                type="text"
                placeholder="Enter full name"
                className={inputClass}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Email Address *</label>
              <input
                type="email"
                placeholder="Enter email address"
                className={inputClass}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Phone Number *</label>
              <input
                type="text"
                placeholder="Enter phone number"
                className={inputClass}
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Department *</label>
              <select
                className={inputClass}
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value as Department })}
              >
                {DEPARTMENTS.slice(1).map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Role *</label>
              <select
                className={inputClass}
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'employee' })}
              >
                <option value="employee">Employee</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
