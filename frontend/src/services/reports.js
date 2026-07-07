import { apiRequest } from './api';

export async function getSummaryReport() {
  return apiRequest('/reports/summary', { method: 'GET' });
}

export async function getOfficeReport(officeId) {
  return apiRequest(`/reports/office/${officeId}`, { method: 'GET' });
}

export async function getStaffReport(staffId) {
  return apiRequest(`/reports/staff/${staffId}`, { method: 'GET' });
}
