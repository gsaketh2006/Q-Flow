import { apiRequest } from './api';
import type { Service } from '../types/service';

export async function getServices(officeId?: number): Promise<Service[]> {
  const params: Record<string, number> = {};
  if (officeId) {
    params.office_id = officeId;
  }
  return apiRequest<Service[]>('/services', { method: 'GET', params });
}

export async function getService(id: number): Promise<Service> {
  return apiRequest<Service>(`/services/${id}`, { method: 'GET' });
}

export async function createService(serviceData: Partial<Service>): Promise<Service> {
  return apiRequest<Service>('/services', {
    method: 'POST',
    body: JSON.stringify(serviceData),
  });
}

export async function updateService(id: number, serviceData: Partial<Service>): Promise<Service> {
  return apiRequest<Service>(`/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(serviceData),
  });
}

export async function deleteService(id: number): Promise<void> {
  return apiRequest<void>(`/services/${id}`, { method: 'DELETE' });
}
