import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Stethoscope, BarChart3, Plus, Building2, Phone, Edit3, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { buildDoctorCaseStats, masterDoctorRows } from '../lib/doctorAnalytics';
import { nextDoctorCode } from '../lib/doctorMaster';
import { normalizeTitleCaseWords } from '../lib/textFormat';
import { NEXUS_FORM_CONTROL, NEXUS_SEARCH_CONTROL } from '../constants/formStyles';
import type { Doctor } from '../types';

const emptyForm = {
  name: '',
  phone: '',
  specialization: '',
  hospitalId: '',
};

export const Doctors: React.FC = () => {
  const { doctors, cases, hospitals, createDoctor, updateDoctor, deleteDoctor, viewMode } = useStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => buildDoctorCaseStats(cases, doctors), [cases, doctors]);
  const rows = useMemo(() => masterDoctorRows(doctors, stats), [doctors, stats]);
  const nextCode = useMemo(() => nextDoctorCode(doctors), [doctors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => {
        const doc = doctors.find(d => d.id === r.doctorId);
        return (
          r.name.toLowerCase().includes(q) ||
          (r.doctorCode ?? '').toLowerCase().includes(q) ||
          (doc?.specialization ?? '').toLowerCase().includes(q)
        );
      }
    );
  }, [rows, search, doctors]);

  const withCases = rows.filter((r) => r.total > 0).length;
  const totalCaseLinks = rows.reduce((n, r) => n + r.total, 0);
  const activeCases = rows.reduce((n, r) => n + r.active, 0);
  const top = [...rows].sort((a, b) => b.total - a.total)[0];
  const maxCases = top?.total ?? 1;

  const topTen = useMemo(
    () => [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    [rows],
  );

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingDoctor(null);
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (doc: Doctor) => {
    setForm({
      name: doc.name || '',
      phone: doc.phone || '',
      specialization: doc.specialization || '',
      hospitalId: doc.hospitalId || '',
    });
    setEditingDoctor(doc);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = normalizeTitleCaseWords(form.name.trim());
    if (!name) {
      setError('Enter the doctor name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingDoctor) {
        await updateDoctor(editingDoctor.id, {
          name,
          phone: form.phone.trim(),
          specialization: form.specialization.trim(),
          hospitalId: form.hospitalId,
        });
      } else {
        await createDoctor({
          name,
          phone: form.phone.trim(),
          specialization: form.specialization.trim(),
          hospitalId: form.hospitalId,
        });
      }
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save doctor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <NexusPage maxWidthClass="max-w-[1400px]">
      <NexusPageHeader
        title="Doctors"
        description={`Master surgeon directory — ${doctors.length} registered doctors`}
        actions={
          viewMode === 'admin' ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleOpenCreate}
            >
              Add doctor
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardBody className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Stethoscope className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Doctors</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{doctors.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">With Cases</p>
              <p className="text-2xl font-bold text-emerald-600 mt-0.5">{withCases}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Case Links</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{totalCaseLinks}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Cases</p>
              <p className="text-2xl font-bold text-amber-600 mt-0.5">{activeCases}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        <div className="flex-1">
          <div className="relative w-full max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, code, or specialization..."
              className={NEXUS_SEARCH_CONTROL}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((r, idx) => {
              const doc = doctors.find(d => d.id === r.doctorId);
              const hospital = hospitals.find(h => h.id === doc?.hospitalId);

              return (
                <motion.div
                  key={r.doctorId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                >
                  <Card hover className="h-full flex flex-col">
                    <CardBody className="flex flex-col h-full p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={r.name} size="md" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 truncate" title={r.name}>
                              {r.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge className="font-mono text-[10px] bg-[var(--color-accent-muted)] text-[var(--color-accent)] border-[var(--color-accent)]/20">
                                {r.doctorCode ?? 'NO-CODE'}
                              </Badge>
                              {doc?.specialization && (
                                <span className="text-xs text-gray-500 truncate" title={doc.specialization}>
                                  {doc.specialization}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {viewMode === 'admin' && (
                          <div className="flex items-center shrink-0 -mr-2 -mt-1">
                            <button
                              onClick={() => doc && handleOpenEdit(doc)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-[var(--color-accent)] hover:bg-blue-50 transition-colors"
                              title="Edit doctor"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${r.name}?`)) {
                                  deleteDoctor(r.doctorId);
                                }
                              }}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete doctor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto space-y-2 pt-3 border-t border-gray-100">
                        {hospital ? (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="truncate" title={hospital.name}>{hospital.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                            <Building2 className="h-3.5 w-3.5 opacity-50 shrink-0" />
                            <span>No primary hospital</span>
                          </div>
                        )}

                        {doc?.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span>{doc.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="bg-gray-50 rounded-lg p-2.5">
                          <p className="text-[10px] text-gray-500 font-medium mb-0.5">Total Cases</p>
                          <p className="text-sm font-bold text-gray-900">{r.total}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2.5">
                          <p className="text-[10px] text-emerald-700 font-medium mb-0.5">Active / Done</p>
                          <p className="text-sm font-bold text-emerald-700">
                            {r.active} <span className="text-emerald-500/50">/</span> {r.completed}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm mt-4">
              <Stethoscope className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900">No doctors found</h3>
              <p className="text-xs text-gray-500 mt-1">Try adjusting your search query.</p>
            </div>
          )}
        </div>

        {/* Sidebar for Top Surgeons Chart */}
        {top && top.total > 0 && (
          <div className="w-full lg:w-80 shrink-0">
            <Card className="sticky top-20">
              <CardBody className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-sm font-bold text-gray-900">Top Surgeons</h3>
                </div>
                
                <div className="space-y-4">
                  {topTen.map((r, i) => (
                    <div key={r.doctorId} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-800 truncate pr-2" title={r.name}>
                          {i + 1}. {r.name}
                        </span>
                        <span className="font-bold text-gray-900">{r.total}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, (r.total / maxCases) * 100)}%` }}
                          transition={{ duration: 0.5, delay: i * 0.1 }}
                          className="h-full rounded-full bg-[var(--color-accent)] opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => !saving && setShowModal(false)} title={editingDoctor ? "Edit doctor" : "Add doctor"}>
        <form onSubmit={handleSave} className="space-y-4">
          {!editingDoctor && (
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
              A new MLS-DOC code (<strong className="font-mono text-[var(--color-accent)]">{nextCode}</strong>) will be assigned automatically.
            </p>
          )}

          <div>
            <label htmlFor="doc-name" className="block text-xs font-medium text-gray-700 mb-1.5">
              Doctor name *
            </label>
            <input
              id="doc-name"
              className={NEXUS_FORM_CONTROL}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={(e) => setForm({ ...form, name: normalizeTitleCaseWords(e.target.value) })}
              placeholder="e.g. Dr. John Doe"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="doc-specialization" className="block text-xs font-medium text-gray-700 mb-1.5">
              Specialization
            </label>
            <input
              id="doc-specialization"
              className={NEXUS_FORM_CONTROL}
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="e.g. Orthopedic Surgeon"
            />
          </div>

          <div>
            <label htmlFor="doc-hospital" className="block text-xs font-medium text-gray-700 mb-1.5">
              Primary Hospital
            </label>
            <select
              id="doc-hospital"
              className={NEXUS_FORM_CONTROL}
              value={form.hospitalId}
              onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
            >
              <option value="">-- Select a hospital --</option>
              {hospitals.filter(h => h.status === 'Active').map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.branch ? `(${h.branch})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="doc-phone" className="block text-xs font-medium text-gray-700 mb-1.5">
              Phone Number
            </label>
            <input
              id="doc-phone"
              type="tel"
              className={NEXUS_FORM_CONTROL}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          {error ? <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-100">{error}</p> : null}
          
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : (editingDoctor ? 'Save changes' : 'Add doctor')}
            </Button>
          </div>
        </form>
      </Modal>
    </NexusPage>
  );
};
