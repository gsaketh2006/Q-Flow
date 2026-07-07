import { apiRequest } from './api';

export async function getServices(officeId) {
  const params = {};
  if (officeId) {
    params.office_id = officeId;
  }
  return apiRequest('/services', { method: 'GET', params });
}

export async function getService(id) {
  return apiRequest(`/services/${id}`, { method: 'GET' });
}

export async function createService(serviceData) {
  return apiRequest('/services', {
    method: 'POST',
    body: JSON.stringify(serviceData),
  });
}

export async function updateService(id, serviceData) {
  return apiRequest(`/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(serviceData),
  });
}

export async function deleteService(id) {
  return apiRequest(`/services/${id}`, { method: 'DELETE' });
}
