import { apiRequest } from './api';
import type { Office, Counter, Holiday } from '../types/office';

export async function getOffices(city?: string): Promise<Office[]> {
  const params: Record<string, string> = {};
  if (city) {
    params.city = city;
  }
  return apiRequest<Office[]>('/offices', { method: 'GET', params });
}

export async function getOffice(id: number): Promise<Office> {
  return apiRequest<Office>(`/offices/${id}`, { method: 'GET' });
}

export async function createOffice(officeData: Partial<Office>): Promise<Office> {
  return apiRequest<Office>('/offices', {
    method: 'POST',
    body: JSON.stringify(officeData),
  });
}

export async function updateOffice(id: number, officeData: Partial<Office>): Promise<Office> {
  return apiRequest<Office>(`/offices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(officeData),
  });
}

export async function deleteOffice(id: number): Promise<void> {
  return apiRequest<void>(`/offices/${id}`, { method: 'DELETE' });
}

// --- COUNTERS ---
export async function getCounters(officeId: number): Promise<Counter[]> {
  return apiRequest<Counter[]>(`/offices/${officeId}/counters`, { method: 'GET' });
}

export async function createCounter(
  officeId: number,
  name: string,
  assignedStaffId?: number | null
): Promise<Counter> {
  const params: Record<string, string | number> = { counter_name: name };
  if (assignedStaffId !== undefined && assignedStaffId !== null) {
    params.assigned_staff_id = assignedStaffId;
  }
  return apiRequest<Counter>(`/offices/${officeId}/counters`, {
    method: 'POST',
    params,
  });
}

export async function updateCounter(
  officeId: number,
  counterId: number,
  counterData: Partial<Counter>
): Promise<Counter> {
  return apiRequest<Counter>(`/offices/${officeId}/counters/${counterId}`, {
    method: 'PUT',
    body: JSON.stringify(counterData),
  });
}

export async function deleteCounter(officeId: number, counterId: number): Promise<void> {
  return apiRequest<void>(`/offices/${officeId}/counters/${counterId}`, {
    method: 'DELETE',
  });
}

// --- HOLIDAYS ---
export async function getHolidays(officeId: number): Promise<Holiday[]> {
  return apiRequest<Holiday[]>(`/offices/${officeId}/holidays`, { method: 'GET' });
}

export async function createHoliday(
  officeId: number,
  holidayData: { date: string; description: string }
): Promise<Holiday> {
  return apiRequest<Holiday>(`/offices/${officeId}/holidays`, {
    method: 'POST',
    body: JSON.stringify({ ...holidayData, office_id: officeId }),
  });
}

export async function deleteHoliday(officeId: number, holidayId: number): Promise<void> {
  return apiRequest<void>(`/offices/${officeId}/holidays/${holidayId}`, {
    method: 'DELETE',
  });
}
