export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  phone?: string;
  language_pref?: string;
  password: string;
}
