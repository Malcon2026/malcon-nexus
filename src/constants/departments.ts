import type { Department } from '../types';

export const DEPARTMENTS_WITH_ALL: (Department | 'All')[] = [
  'All',
  'Stores',
  'Delivery',
  'Drivers',
  'Scrub Person',
  'Cleaning Department',
  'Stores Audit',
  'Accounts',
  'Bill Submission',
  'Office Staff',
  'Admin',
];

export const departmentSelectClass =
  'px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white';
