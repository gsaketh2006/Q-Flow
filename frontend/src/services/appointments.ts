import { apiRequest } from './api';
import type { Appointment, AppointmentWithDetails } from '../types/appointment';
import type { QueueEntry } from '../types/queue';

export interface AppointmentFilters {
  office_id?: number;
  status_filter?: string;
  date_from?: string;
  date_to?: string;
  user_id?: number;
}

export async function getAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
  const params: Record<string, string | number> = {};
  if (filters.office_id) params.office_id = filters.office_id;
  if (filters.status_filter) params.status_filter = filters.status_filter;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.user_id) params.user_id = filters.user_id;

  return apiRequest<Appointment[]>('/appointments', { method: 'GET', params });
}

export async function getAppointment(id: number): Promise<AppointmentWithDetails> {
  return apiRequest<AppointmentWithDetails>(`/appointments/${id}`, { method: 'GET' });
}

export async function createAppointment(apptData: {
  office_id: number;
  service_id: number;
  scheduled_time: string;
  user_id?: number;
}): Promise<Appointment> {
  return apiRequest<Appointment>('/appointments', {
    method: 'POST',
    body: JSON.stringify(apptData),
  });
}

export async function cancelAppointment(id: number): Promise<Appointment> {
  return apiRequest<Appointment>(`/appointments/${id}/cancel`, { method: 'PUT' });
}

export async function checkInAppointment(id: number, qrCodeToken?: string): Promise<QueueEntry> {
  const params: Record<string, string> = {};
  if (qrCodeToken) {
    params.qr_code_token = qrCodeToken;
  }
  return apiRequest<QueueEntry>(`/appointments/${id}/check-in`, {
    method: 'PUT',
    params,
  });
}

export async function getAppointmentQR(id: number): Promise<{ qr_code_token: string }> {
  return apiRequest<{ qr_code_token: string }>(`/appointments/${id}/qr`, { method: 'GET' });
}
