import { apiRequest } from './api';
import type { SummaryReport, OfficeReport, StaffReport } from '../types/report';

export async function getSummaryReport(): Promise<SummaryReport> {
  return apiRequest<SummaryReport>('/reports/summary', { method: 'GET' });
}

export async function getOfficeReport(officeId: number): Promise<OfficeReport> {
  return apiRequest<OfficeReport>(`/reports/office/${officeId}`, { method: 'GET' });
}

export async function getStaffReport(staffId: number): Promise<StaffReport> {
  return apiRequest<StaffReport>(`/reports/staff/${staffId}`, { method: 'GET' });
}
