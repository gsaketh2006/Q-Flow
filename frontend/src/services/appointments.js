import { apiRequest } from './api';

export async function getAppointments(filters = {}) {
  const params = {};
  if (filters.office_id) params.office_id = filters.office_id;
  if (filters.status_filter) params.status_filter = filters.status_filter;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.user_id) params.user_id = filters.user_id;

  return apiRequest('/appointments', { method: 'GET', params });
}

export async function getAppointment(id) {
  return apiRequest(`/appointments/${id}`, { method: 'GET' });
}

export async function createAppointment(apptData) {
  return apiRequest('/appointments', {
    method: 'POST',
    body: JSON.stringify(apptData),
  });
}

export async function cancelAppointment(id) {
  return apiRequest(`/appointments/${id}/cancel`, { method: 'PUT' });
}

export async function checkInAppointment(id, qrCodeToken) {
  const params = {};
  if (qrCodeToken) {
    params.qr_code_token = qrCodeToken;
  }
  return apiRequest(`/appointments/${id}/check-in`, {
    method: 'PUT',
    params,
  });
}

export async function getAppointmentQR(id) {
  return apiRequest(`/appointments/${id}/qr`, { method: 'GET' });
}
