import { apiRequest } from './api';

export async function getLiveQueue(officeId) {
  return apiRequest('/queue/live', {
    method: 'GET',
    params: { office_id: officeId },
  });
}

export async function getActiveQueue(officeId) {
  return apiRequest('/queue/active', {
    method: 'GET',
    params: { office_id: officeId },
  });
}

export async function callNextTicket(counterId) {
  return apiRequest('/queue/call-next', {
    method: 'POST',
    params: { counter_id: counterId },
  });
}

export async function startService(entryId) {
  return apiRequest(`/queue/${entryId}/start-service`, { method: 'POST' });
}

export async function completeService(entryId) {
  return apiRequest(`/queue/${entryId}/complete`, { method: 'POST' });
}

export async function skipService(entryId) {
  return apiRequest(`/queue/${entryId}/skip`, { method: 'POST' });
}

export async function reorderQueue(officeId, entryId, newPosition) {
  return apiRequest('/queue/reorder', {
    method: 'POST',
    params: {
      office_id: officeId,
      entry_id: entryId,
      new_position: newPosition,
    },
  });
}
