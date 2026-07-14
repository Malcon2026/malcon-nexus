import type { Employee, Hospital, Doctor, WorkflowStage, Department } from '../../types';

export const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation',
  'Surgery',
  'Cleaning',
  'Audit',
  'Billing',
  'Bill Submission',
  'Completed',
];

export const STAGE_DEPARTMENT_MAP: Record<WorkflowStage, Department | null> = {
  'Kit Preparation': 'Stores',
  'Surgery': 'Scrub Person',
  'Cleaning': 'Cleaning Department',
  'Audit': 'Stores Audit',
  'Billing': 'Accounts',
  'Bill Submission': 'Bill Submission',
  'Completed': null,
};

export const employees: Employee[] = [];

export const hospitals: Hospital[] = [
  {
    id: 'hosp-001',
    name: 'Apollo Hospitals',
    branch: '',
    address: '21 Greams Lane, Off Greams Road',
    city: 'Chennai',
    contactPerson: 'Mr. Ramesh Iyer',
    phone: '+91 44 2829 0200',
    email: 'procurement@apollohospitals.com',
    status: 'Active',
  },
  {
    id: 'hosp-002',
    name: 'Fortis Healthcare',
    branch: '',
    address: 'Sector 62, Phase VIII',
    city: 'Mohali',
    contactPerson: 'Ms. Neha Kapoor',
    phone: '+91 172 5096 001',
    email: 'procurement@fortishealthcare.com',
    status: 'Active',
  },
  {
    id: 'hosp-003',
    name: 'Manipal Hospitals',
    branch: '',
    address: '98 HAL Airport Road',
    city: 'Bengaluru',
    contactPerson: 'Dr. Suresh Rao',
    phone: '+91 80 2502 4444',
    email: 'implants@manipalhospitals.com',
    status: 'Active',
  },
  {
    id: 'hosp-004',
    name: 'Max Super Speciality Hospital',
    branch: '',
    address: '1 Press Enclave Road, Saket',
    city: 'New Delhi',
    contactPerson: 'Mr. Ajay Sharma',
    phone: '+91 11 2651 5050',
    email: 'procurement@maxhealthcare.in',
    status: 'Active',
  },
  {
    id: 'hosp-005',
    name: 'Kokilaben Dhirubhai Ambani Hospital',
    branch: '',
    address: 'Rao Saheb Achutrao Patwardhan Marg, Four Bunglows',
    city: 'Mumbai',
    contactPerson: 'Ms. Preethi Nair',
    phone: '+91 22 4269 6969',
    email: 'implants@kokilabenhospital.com',
    status: 'Active',
  },
  {
    id: 'hosp-006',
    name: 'KIMS Hospital',
    branch: '',
    address: '1-8-31/1, Minister Road, Secunderabad',
    city: 'Hyderabad',
    contactPerson: 'Mr. Venkat Rao',
    phone: '+91 40 4488 5000',
    email: 'procurement@kimshospitals.com',
    status: 'Active',
  },
  {
    id: 'hosp-007',
    name: 'Narayana Health City',
    branch: '',
    address: '258/A Bommasandra Industrial Area',
    city: 'Bengaluru',
    contactPerson: 'Ms. Anitha Krishnan',
    phone: '+91 80 7122 2200',
    email: 'implants@narayanahealth.org',
    status: 'Active',
  },
];

export const doctors: Doctor[] = [
  { id: 'doc-001', name: 'Dr. Ramesh Krishnamurthy', specialization: 'Orthopaedic Surgery', hospitalId: 'hosp-001', phone: '+91 98400 12345' },
  { id: 'doc-002', name: 'Dr. Pradeep Sinha', specialization: 'Joint Replacement', hospitalId: 'hosp-002', phone: '+91 98101 23456' },
  { id: 'doc-003', name: 'Dr. Vandana Murthy', specialization: 'Spine Surgery', hospitalId: 'hosp-003', phone: '+91 98450 34567' },
  { id: 'doc-004', name: 'Dr. Arvind Kapoor', specialization: 'Trauma & Orthopaedics', hospitalId: 'hosp-004', phone: '+91 98111 45678' },
  { id: 'doc-005', name: 'Dr. Sheela Menon', specialization: 'Arthroplasty', hospitalId: 'hosp-005', phone: '+91 98201 56789' },
  { id: 'doc-006', name: 'Dr. Subramaniam Pillai', specialization: 'Orthopaedic Oncology', hospitalId: 'hosp-006', phone: '+91 98400 67890' },
  { id: 'doc-007', name: 'Dr. Rajiv Bhandari', specialization: 'Sports Medicine & Arthroscopy', hospitalId: 'hosp-007', phone: '+91 98450 78901' },
  { id: 'doc-008', name: 'Dr. Meena Iyer', specialization: 'Paediatric Orthopaedics', hospitalId: 'hosp-001', phone: '+91 98400 89012' },
];
