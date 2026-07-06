export interface Office {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  working_hours: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Counter {
  id: number;
  office_id: number;
  name: string;
  assigned_staff_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assigned_staff_name?: string;
}

export interface Holiday {
  id: number;
  office_id: number | null;
  date: string;
  description: string;
  created_at: string;
}
