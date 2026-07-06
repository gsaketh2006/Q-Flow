import { apiRequest } from './api';
import type { QueueEntry, QueueEntryWithDetails, PublicQueueBoard } from '../types/queue';

export async function getLiveQueue(officeId: number): Promise<PublicQueueBoard> {
  return apiRequest<PublicQueueBoard>('/queue/live', {
    method: 'GET',
    params: { office_id: officeId },
  });
}

export async function getActiveQueue(officeId: number): Promise<QueueEntryWithDetails[]> {
  return apiRequest<QueueEntryWithDetails[]>('/queue/active', {
    method: 'GET',
    params: { office_id: officeId },
  });
}

export async function callNextTicket(counterId: number): Promise<QueueEntryWithDetails> {
  return apiRequest<QueueEntryWithDetails>('/queue/call-next', {
    method: 'POST',
    params: { counter_id: counterId },
  });
}

export async function startService(entryId: number): Promise<QueueEntry> {
  return apiRequest<QueueEntry>(`/queue/${entryId}/start-service`, { method: 'POST' });
}

export async function completeService(entryId: number): Promise<QueueEntry> {
  return apiRequest<QueueEntry>(`/queue/${entryId}/complete`, { method: 'POST' });
}

export async function skipService(entryId: number): Promise<QueueEntry> {
  return apiRequest<QueueEntry>(`/queue/${entryId}/skip`, { method: 'POST' });
}

export async function reorderQueue(
  officeId: number,
  entryId: number,
  newPosition: number
): Promise<QueueEntryWithDetails[]> {
  return apiRequest<QueueEntryWithDetails[]>('/queue/reorder', {
    method: 'POST',
    params: {
      office_id: officeId,
      entry_id: entryId,
      new_position: newPosition,
    },
  });
}
