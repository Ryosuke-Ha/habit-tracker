const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const extraHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  };

  const mergedHeaders: Record<string, string> = {
    ...extraHeaders,
    ...(options.headers as Record<string, string> | undefined ?? {}),
  };

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: mergedHeaders,
  });
}
