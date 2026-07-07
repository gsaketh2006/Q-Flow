import { apiRequest } from './api';

export async function getOffices(city) {
  const params = {};
  if (city) {
    params.city = city;
  }
  return apiRequest('/offices', { method: 'GET', params });
}

export async function getOffice(id) {
  return apiRequest(`/offices/${id}`, { method: 'GET' });
}

export async function createOffice(officeData) {
  return apiRequest('/offices', {
    method: 'POST',
    body: JSON.stringify(officeData),
  });
}

export async function updateOffice(id, officeData) {
  return apiRequest(`/offices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(officeData),
  });
}

export async function deleteOffice(id) {
  return apiRequest(`/offices/${id}`, { method: 'DELETE' });
}

// --- COUNTERS ---
export async function getCounters(officeId) {
  return apiRequest(`/offices/${officeId}/counters`, { method: 'GET' });
}

export async function createCounter(officeId, name, assignedStaffId) {
  const params = { counter_name: name };
  if (assignedStaffId !== undefined && assignedStaffId !== null) {
    params.assigned_staff_id = assignedStaffId;
  }
  return apiRequest(`/offices/${officeId}/counters`, {
    method: 'POST',
    params,
  });
}

export async function updateCounter(officeId, counterId, counterData) {
  return apiRequest(`/offices/${officeId}/counters/${counterId}`, {
    method: 'PUT',
    body: JSON.stringify(counterData),
  });
}

export async function deleteCounter(officeId, counterId) {
  return apiRequest(`/offices/${officeId}/counters/${counterId}`, {
    method: 'DELETE',
  });
}

// --- HOLIDAYS ---
export async function getHolidays(officeId) {
  return apiRequest(`/offices/${officeId}/holidays`, { method: 'GET' });
}

export async function createHoliday(officeId, holidayData) {
  return apiRequest(`/offices/${officeId}/holidays`, {
    method: 'POST',
    body: JSON.stringify({ ...holidayData, office_id: officeId }),
  });
}

export async function deleteHoliday(officeId, holidayId) {
  return apiRequest(`/offices/${officeId}/holidays/${holidayId}`, {
    method: 'DELETE',
  });
}
