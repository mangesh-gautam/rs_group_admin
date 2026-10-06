export type ApiErrorBody = {
  error?: string;
  code?: string;
  details?: Record<string, string>;
  retryAfter?: number;
  attemptsRemaining?: number;
};

/** Every failed API call is thrown as an ApiError with the backend's code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: ApiErrorBody = {},
  ) {
    super(message);
  }
  get details() {
    return this.body.details ?? {};
  }
}

const NETWORK_MESSAGE = "Unable to reach the server. Check your connection and try again.";
const SERVER_MESSAGE = "The server is not responding right now. Please try again shortly.";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

/** Low-level JSON request to our own origin (/api/* is proxied to the gateway). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_MESSAGE);
  }

  if (res.status === 204) return undefined as T;

  const data: ApiErrorBody & Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500 && !data.code) {
      throw new ApiError(res.status, "SERVER_UNAVAILABLE", SERVER_MESSAGE);
    }
    throw new ApiError(
      res.status,
      data.code ?? `HTTP_${res.status}`,
      data.error ?? "Something went wrong. Please try again.",
      data,
    );
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
