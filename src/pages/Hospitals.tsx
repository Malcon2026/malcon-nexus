import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Trash2, Edit3, Building2, MapPin, Phone, Mail, User, Filter } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { Hospital } from '../types';

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

const emptyHospitalForm = {
  name: '',
  branch: '',
  address: '',
  city: '',
  contactPerson: '',
  phone: '',
  email: '',
};

export const Hospitals: React.FC = () => {
  const { hospitals, viewMode, createHospital, updateHospital, deleteHospital, cases } = useStore();
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [form, setForm] = useState(emptyHospitalForm);

  // Unique cities for filter
  const cities = Array.from(new Set(hospitals.map(h => h.city))).sort();

  const filtered = hospitals
    .filter(h => filterCity === 'All' || h.city === filterCity)
    .filter(h => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.branch?.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.contactPerson.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q)
      );
    });

  // Stats per hospital
  const getHospitalStats = (hospitalId: string) => {
    const hospCases = cases.filter(c => c.hospital.id === hospitalId);
    return {
      total: hospCases.length,
      active: hospCases.filter(c => c.status === 'Active' || c.status === 'Waiting For Approval').length,
      completed: hospCases.filter(c => c.status === 'Completed').length,
    };
  };

  const handleOpenCreate = () => {
    setForm(emptyHospitalForm);
    setEditingHospital(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (hospital: Hospital) => {
    setForm({
      name: hospital.name,
      branch: hospital.branch,
      address: hospital.address,
      city: hospital.city,
      contactPerson: hospital.contactPerson,
      phone: hospital.phone,
      email: hospital.email,
    });
    setEditingHospital(hospital);
    setShowCreateModal(true);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name || !form.city) {
      alert('Please fill in all required fields (Name, City).');
      return;
    }

    if (editingHospital) {
      updateHospital(editingHospital.id, { ...form });
    } else {
      createHospital({ ...form });
    }

    setShowCreateModal(false);
    setForm(emptyHospitalForm);
    setEditingHospital(null);
  };

  const handleDelete = (hospital: Hospital) => {
    if (confirm(`Are you sure you want to delete ${hospital.name}? This action cannot be undone.`)) {
      deleteHospital(hospital.id);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Hospitals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hospitals.length} registered hospitals across {cities.length} cities
          </p>
        </div>
        {viewMode === 'admin' && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleOpenCreate}
          >
            Add Hospital
          </Button>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Total Hospitals</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{hospitals.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{hospitals.filter(h => h.status === 'Active').length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Cities</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{cities.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-500">Total Cases</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{cases.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search hospitals..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCity('All')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterCity === 'All' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {cities.map(city => (
            <button
              key={city}
              onClick={() => setFilterCity(city)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterCity === city ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Hospital Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((hospital, idx) => {
          const stats = getHospitalStats(hospital.id);
          return (
            <motion.div
              key={hospital.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <Card hover>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate" title={hospital.name}>{hospital.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {[hospital.branch, hospital.city].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Badge className={`text-[10px] ${hospital.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {hospital.status}
                      </Badge>
                      {viewMode === 'admin' && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(hospital)}
                            className="p-1 rounded-md text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Edit Hospital"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(hospital)}
                            className="p-1 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete Hospital"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                      <p className="text-[10px] text-gray-400">Total Cases</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-indigo-600">{stats.active}</p>
                      <p className="text-[10px] text-gray-400">Active</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
                      <p className="text-[10px] text-gray-400">Completed</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{hospital.contactPerson}</span>
                    </div>
                    {hospital.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{hospital.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{hospital.email}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 truncate">
                      <MapPin className="h-3 w-3 inline-block mr-1" />
                      {hospital.address}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No hospitals found</p>
          <p className="text-xs mt-1">
            {hospitals.length === 0 ? 'Add your first hospital to get started' : 'Try adjusting your search or filters'}
          </p>
        </div>
      )}

      {/* Create / Edit Hospital Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditingHospital(null); }}
          title={editingHospital ? 'Edit Hospital' : 'Add New Hospital'}
          subtitle={editingHospital ? 'Update hospital details' : 'Register a new hospital in the system'}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => { setShowCreateModal(false); setEditingHospital(null); }}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => handleSubmit()}>
                {editingHospital ? 'Save Changes' : 'Add Hospital'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Hospital Name *</label>
              <input
                type="text"
                placeholder="Enter hospital name"
                className={inputClass}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Hospital Branch</label>
              <input
                type="text"
                placeholder="Enter branch name"
                className={inputClass}
                value={form.branch}
                onChange={e => setForm({ ...form, branch: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>City *</label>
                <input
                  type="text"
                  placeholder="Enter city"
                  className={inputClass}
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="text"
                  placeholder="Enter phone number (optional)"
                  className={inputClass}
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input
                type="text"
                placeholder="Enter full address"
                className={inputClass}
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Contact Person</label>
                <input
                  type="text"
                  placeholder="Enter name"
                  className={inputClass}
                  value={form.contactPerson}
                  onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  placeholder="Enter email"
                  className={inputClass}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
