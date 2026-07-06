export interface QueueEntry {
  id: number;
  appointment_id: number;
  office_id: number;
  counter_id: number | null;
  position: number;
  status: 'waiting' | 'called' | 'processing' | 'completed' | 'skipped';
  estimated_wait_minutes: number;
  called_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueEntryWithDetails extends QueueEntry {
  citizen_name: string;
  service_name: string;
  ticket_number: string;
  counter_name: string | null;
}

export interface PublicServingTicket {
  id: number;
  ticket_number: string;
  service_name: string;
  counter_name: string;
  status: string;
  called_at: string;
}

export interface PublicWaitingTicket {
  id: number;
  ticket_number: string;
  service_name: string;
  estimated_wait_minutes: number;
  position: number;
}

export interface PublicQueueBoard {
  now_serving: PublicServingTicket[];
  waiting_list: PublicWaitingTicket[];
}
