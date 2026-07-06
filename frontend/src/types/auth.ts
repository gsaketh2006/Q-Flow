export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  language_pref: string;
  role_id: number;
  role_name: 'citizen' | 'staff' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
