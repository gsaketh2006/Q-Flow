const BASE_URL = 'http://localhost:8000/api/v1';

let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('qflow_logged_in', 'true');
  } else {
    localStorage.removeItem('qflow_logged_in');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function hasSessionIndicator(): boolean {
  return localStorage.getItem('qflow_logged_in') === 'true';
}

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;
  
  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      searchParams.append(key, String(val));
    });
    url += `?${searchParams.toString()}`;
  }

  const defaultHeaders: Record<string, string> = {};
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
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json() as { access_token: string };
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
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          const retryHeaders = {
            ...finalHeaders,
            'Authorization': `Bearer ${token}`,
          };
          fetch(url, { ...rest, headers: retryHeaders })
            .then(async (res) => {
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'An error occurred' }));
                return reject(errorData);
              }
              const contentType = res.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                return resolve(res.json() as Promise<T>);
              }
              return resolve({} as T);
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
      return response.json() as Promise<T>;
    }
    return {} as Promise<T>;
  } catch (error) {
    throw error;
  }
}
