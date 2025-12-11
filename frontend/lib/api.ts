import { config } from "./config";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Centralized API fetch wrapper with:
 * - Automatic credentials: 'include' for HTTP-only cookies
 * - 401 error handling (redirects to login)
 * - Simplified error handling
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include", // Always include cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Handle 401 - redirect to login and clear any stale state
  if (response.status === 401) {
    // Redirect to login page
    window.location.href = "/login";
    throw new AuthError("Authentication required");
  }

  return response;
}

/**
 * Helper for JSON API calls
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Logout helper - clears the HTTP-only cookie
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Always redirect to login, even if logout request fails
    window.location.href = "/login";
  }
}
