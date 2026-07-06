export interface Appointment {
  id: number;
  user_id: number;
  office_id: number;
  service_id: number;
  counter_id: number | null;
  scheduled_time: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  qr_code_token: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentWithDetails extends Appointment {
  citizen_name: string;
  office_name: string;
  service_name: string;
  counter_name: string | null;
}
