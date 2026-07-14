import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Database, Building2, Save, Download, Check } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import { CaseCsvExportModal } from '../components/CaseCsvExportModal';

const tabs = [
  { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
  { id: 'company', label: 'Company', icon: <Building2 className="h-4 w-4" /> },
  { id: 'data', label: 'Data & Export', icon: <Database className="h-4 w-4" /> },
];

const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white";
const labelClass = "block text-xs font-medium text-gray-700 mb-1.5";

// Notification preferences keys
const NOTIF_PREFS_KEY = 'malconnexus_notification_prefs';
const COMPANY_INFO_KEY = 'malconnexus_company_info';

interface NotifPref {
  label: string;
  desc: string;
  key: string;
}

const NOTIF_OPTIONS: NotifPref[] = [
  { label: 'Case Assignments', desc: 'When a new case is assigned to you', key: 'caseAssignments' },
  { label: 'Approval Requests', desc: 'When an employee submits work for review', key: 'approvalRequests' },
  { label: 'Case Status Updates', desc: 'When case status changes', key: 'caseStatusUpdates' },
  { label: 'Upcoming Surgeries', desc: 'Reminders for upcoming surgery dates', key: 'upcomingSurgeries' },
  { label: 'Payment Collections', desc: 'Updates on payment collection status', key: 'paymentCollections' },
  { label: 'System Alerts', desc: 'Critical system notifications', key: 'systemAlerts' },
];

const defaultNotifPrefs: Record<string, boolean> = {
  caseAssignments: true,
  approvalRequests: true,
  caseStatusUpdates: true,
  upcomingSurgeries: false,
  paymentCollections: false,
  systemAlerts: true,
};

const defaultCompanyInfo = {
  companyName: 'Malcon Life Sciences',
  registrationNumber: 'CIN: U85110MH2018PTC305678',
  gstNumber: '27AABCI1234A1Z5',
  city: 'Mumbai, Maharashtra',
};

const loadNotifPrefs = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(NOTIF_PREFS_KEY);
    return stored ? JSON.parse(stored) : { ...defaultNotifPrefs };
  } catch {
    return { ...defaultNotifPrefs };
  }
};

const loadCompanyInfo = () => {
  try {
    const stored = localStorage.getItem(COMPANY_INFO_KEY);
    return stored ? JSON.parse(stored) : { ...defaultCompanyInfo };
  } catch {
    return { ...defaultCompanyInfo };
  }
};

export const Settings: React.FC = () => {
  const { currentUser, updateEmployee, clearAllData, cases } = useStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [showCaseExport, setShowCaseExport] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
  });

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState(loadNotifPrefs);

  // Company info
  const [companyInfo, setCompanyInfo] = useState(loadCompanyInfo);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProfileSave = async () => {
    const { error } = await updateEmployee(currentUser.id, {
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone,
      avatar: profileForm.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
    });
    if (error) {
      alert(error);
      return;
    }
    showSaved();
  };

  const toggleNotifPref = (key: string) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
  };

  const handleCompanySave = () => {
    localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(companyInfo));
    showSaved();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1000px] mx-auto w-full min-w-0">
      <CaseCsvExportModal
        isOpen={showCaseExport}
        onClose={() => setShowCaseExport(false)}
        cases={cases}
        title="Export All Cases to CSV"
      />
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and application preferences</p>
      </div>

      {/* Save confirmation */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg"
        >
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="text-sm text-emerald-700 font-medium">Changes saved successfully</span>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar nav — horizontal on mobile, vertical on desktop */}
        <div className="md:w-48 shrink-0">
          <Card className="p-2">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 sm:gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all mb-0.5 whitespace-nowrap shrink-0 md:w-full ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div key={activeTab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'profile' && (
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900">Profile Information</h3></CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={currentUser.name} size="lg" className="h-14 w-14 text-base" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{currentUser.name}</p>
                      <p className="text-xs text-gray-500">{currentUser.department}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={profileForm.name}
                        onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        className={inputClass}
                        value={profileForm.email}
                        onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input
                        type="tel"
                        className={inputClass}
                        value={profileForm.phone}
                        onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Department</label>
                      <input type="text" className={`${inputClass} bg-gray-50`} defaultValue={currentUser.department} disabled />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" icon={<Save className="h-4 w-4" />} onClick={handleProfileSave}>Save Changes</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900">Notification Preferences</h3></CardHeader>
                <CardBody className="space-y-4">
                  {NOTIF_OPTIONS.map(({ label, desc, key }) => (
                    <div key={key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => toggleNotifPref(key)}
                        className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${notifPrefs[key] ? 'bg-gray-900' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${notifPrefs[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900">Security Settings</h3></CardHeader>
                <CardBody className="space-y-4">
                  <div>
                    <label className={labelClass}>Current Password</label>
                    <input type="password" className={inputClass} placeholder="••••••••" />
                  </div>
                  <div>
                    <label className={labelClass}>New Password</label>
                    <input type="password" className={inputClass} placeholder="••••••••" />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm New Password</label>
                    <input type="password" className={inputClass} placeholder="••••••••" />
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Two-Factor Authentication</p>
                    <p className="text-xs text-blue-600 mt-0.5">Enable 2FA for additional account security</p>
                    <Button variant="outline" size="sm" className="mt-3">Enable 2FA</Button>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" icon={<Save className="h-4 w-4" />}>Update Password</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {activeTab === 'company' && (
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900">Company Information</h3></CardHeader>
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Company Name</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={companyInfo.companyName}
                        onChange={e => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Registration Number</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={companyInfo.registrationNumber}
                        onChange={e => setCompanyInfo({ ...companyInfo, registrationNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>GST Number</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={companyInfo.gstNumber}
                        onChange={e => setCompanyInfo({ ...companyInfo, gstNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>City</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={companyInfo.city}
                        onChange={e => setCompanyInfo({ ...companyInfo, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" icon={<Save className="h-4 w-4" />} onClick={handleCompanySave}>Save Changes</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {activeTab === 'data' && (
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900">Data & Export</h3></CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Export All Cases</p>
                      <p className="text-xs text-gray-500 mt-0.5">Download cases by today, yesterday, last week, last month, or custom range</p>
                    </div>
                    <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => setShowCaseExport(true)}>Export CSV</Button>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Danger Zone</h4>
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-sm font-medium text-red-800">Clear All Data</p>
                      <p className="text-xs text-red-600 mt-0.5">This will remove all cases, notifications, and activity logs. Reference data will be preserved.</p>
                      <Button
                        variant="danger"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
                            clearAllData();
                            showSaved();
                          }
                        }}
                      >
                        Clear Data
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
