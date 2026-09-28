type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function isCsrfFailure(response: Response): Promise<boolean> {
  if (response.status === 419) return true;
  if (response.status !== 403) return false;

  try {
    const body = (await response.clone().json()) as { code?: string; error?: string };
    return body.code === "CSRF_REFRESH_NEEDED" || body.error?.includes("CSRF") === true;
  } catch {
    return false;
  }
}

export function createCsrfFetch(fetchImpl: FetchLike = globalThis.fetch) {
  let cachedToken: string | null = null;
  let tokenPromise: Promise<string> | null = null;

  const acquireToken = (forceRefresh = false): Promise<string> => {
    if (forceRefresh) cachedToken = null;
    if (cachedToken) return Promise.resolve(cachedToken);
    if (tokenPromise) return tokenPromise;

    tokenPromise = fetchImpl("/api/csrf-token", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch CSRF token: ${response.status}`);
        const body = (await response.json()) as { csrfToken?: unknown };
        if (typeof body.csrfToken !== "string" || !body.csrfToken) {
          throw new Error("Invalid CSRF token response");
        }
        cachedToken = body.csrfToken;
        return body.csrfToken;
      })
      .finally(() => {
        tokenPromise = null;
      });

    return tokenPromise;
  };

  const send = (path: string, init: RequestInit, token: string) => {
    const headers = new Headers(init.headers);
    if (init.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("x-csrf-token", token);
    return fetchImpl(path, {
      ...init,
      credentials: "include",
      headers,
    });
  };

  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    const token = await acquireToken();
    const response = await send(path, init, token);
    if (!(await isCsrfFailure(response))) return response;

    const freshToken = await acquireToken(true);
    return send(path, init, freshToken);
  };
}

export const csrfFetch = createCsrfFetch();
