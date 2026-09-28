import { useState, useEffect, useCallback } from 'react';

let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(cachedToken);
  const [isLoading, setIsLoading] = useState(!cachedToken);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    if (cachedToken) {
      setCsrfToken(cachedToken);
      setIsLoading(false);
      return cachedToken;
    }

    if (tokenPromise) {
      const token = await tokenPromise;
      setCsrfToken(token);
      setIsLoading(false);
      return token;
    }

    setIsLoading(true);
    setError(null);
    
    tokenPromise = fetch('/api/csrf-token', {
      credentials: 'include'
    })
      .then(async res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch CSRF token: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format');
        }
        const data = await res.json();
        cachedToken = data.csrfToken;
        return data.csrfToken;
      })
      .catch(err => {
        console.error('CSRF token fetch error:', err);
        return null;
      })
      .finally(() => {
        tokenPromise = null;
      });

    try {
      const token = await tokenPromise;
      setCsrfToken(token);
      if (!token) {
        setError('Failed to fetch security token');
      }
      return token;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedToken) {
      fetchToken();
    }
  }, [fetchToken]);

  const refreshToken = useCallback(async () => {
    cachedToken = null;
    return fetchToken();
  }, [fetchToken]);

  return { csrfToken, isLoading, error, refreshToken };
}

export function getCsrfHeaders(): Record<string, string> {
  if (cachedToken) {
    return { 'X-CSRF-Token': cachedToken };
  }
  return {};
}

export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!cachedToken) {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'include' });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          cachedToken = data.csrfToken;
        }
      }
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
    }
  }

  const headers = new Headers(options.headers);
  if (cachedToken) {
    headers.set('X-CSRF-Token', cachedToken);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 403 || response.status === 419) {
    let errorData: { error?: string; code?: string } = {};
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.clone().json();
      }
    } catch (e) {
    }
    
    const needsRefresh = 
      errorData.code === 'CSRF_REFRESH_NEEDED' || 
      errorData.error?.includes('CSRF') ||
      response.status === 419;
    
    if (needsRefresh) {
      cachedToken = null;
      try {
        const res = await fetch('/api/csrf-token', { credentials: 'include' });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            cachedToken = data.csrfToken;
            
            headers.set('X-CSRF-Token', cachedToken!);
            return fetch(url, {
              ...options,
              headers,
              credentials: 'include'
            });
          }
        }
      } catch (err) {
        console.error('Failed to refresh CSRF token:', err);
      }
    }
  }

  return response;
}
