import { apiRequest, setAccessToken } from './api';

export async function loginUser(email, password) {
  // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await apiRequest('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  setAccessToken(response.access_token);
  return getMe();
}

export async function registerUser(userData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function logoutUser() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

export async function getMe() {
  return apiRequest('/users/me');
}

export async function forgotPassword(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(passwordData) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
}

export async function refreshSession() {
  try {
    const response = await apiRequest('/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(response.access_token);
    return getMe();
  } catch (err) {
    setAccessToken(null);
    return null;
  }
}
