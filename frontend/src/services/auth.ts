import { apiRequest, setAccessToken } from './api';
import type { User, TokenResponse } from '../types/auth';

export async function loginUser(email: string, password: string): Promise<User> {
  // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  setAccessToken(response.access_token);
  return getMe();
}

export async function registerUser(userData: any): Promise<User> {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function logoutUser(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/users/me');
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(passwordData: any): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
}

export async function refreshSession(): Promise<User | null> {
  try {
    const response = await apiRequest<TokenResponse>('/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(response.access_token);
    return getMe();
  } catch (err) {
    setAccessToken(null);
    return null;
  }
}
