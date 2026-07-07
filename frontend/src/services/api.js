const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : 'http://127.0.0.1:8000/api/v1';

let accessToken = null;
let isRefreshing = false;
let refreshSubscribers = [];

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem('qflow_logged_in', 'true');
  } else {
    localStorage.removeItem('qflow_logged_in');
  }
}

export function getAccessToken() {
  return accessToken;
}

export function hasSessionIndicator() {
  return localStorage.getItem('qflow_logged_in') === 'true';
}

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiRequest(endpoint, options = {}) {
  const { params, headers, ...rest } = options;

  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      searchParams.append(key, String(val));
    });
    url += `?${searchParams.toString()}`;
  }

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const finalHeaders = {
    ...defaultHeaders,
    ...headers,
  };

  try {
    const response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      credentials: 'include', // Required for httpOnly refresh_token cookie to be sent cross-origin
    });

    // Handle token refresh on 401 Unauthorized (unless it's already a login or refresh request)
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          // POST /auth/refresh relies on the httpOnly cookie sent automatically by the browser
          const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Send httpOnly refresh_token cookie
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setAccessToken(data.access_token);
            isRefreshing = false;
            onRefreshed(data.access_token);
          } else {
            isRefreshing = false;
            setAccessToken(null);
            window.dispatchEvent(new Event('auth-logout'));
            throw new Error('Session expired');
          }
        } catch (err) {
          isRefreshing = false;
          setAccessToken(null);
          window.dispatchEvent(new Event('auth-logout'));
          throw err;
        }
      }

      // Return a promise that resolves when the token refresh finishes
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          const retryHeaders = {
            ...finalHeaders,
            'Authorization': `Bearer ${token}`,
          };
          fetch(url, { ...rest, headers: retryHeaders, credentials: 'include' })
            .then(async (res) => {
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'An error occurred' }));
                return reject(errorData);
              }
              const contentType = res.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                return resolve(res.json());
              }
              return resolve({});
            })
            .catch(reject);
        });
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
      throw errorData;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return {};
  } catch (error) {
    throw error;
  }
}
