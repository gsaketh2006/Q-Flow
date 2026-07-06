export interface SummaryReport {
  total_appointments: number;
  completed_appointments: number;
  no_show_appointments: number;
  no_show_rate_percent: number;
  average_wait_time_minutes: number;
  average_service_time_minutes: number;
}

export interface OfficeReport {
  office_id: number;
  total_appointments: number;
  completed_appointments: number;
  no_show_appointments: number;
  no_show_rate_percent: number;
  average_wait_time_minutes: number;
  average_service_time_minutes: number;
}

export interface StaffReport {
  staff_user_id: number;
  tickets_completed: number;
  average_service_time_minutes: number;
}
