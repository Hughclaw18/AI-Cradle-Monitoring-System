import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/** Maps HTTP status codes to friendly messages shown in the UI */
function friendlyHttpError(status: number, serverText: string): string {
  // Try to extract a clean message from the server JSON first
  try {
    const json = JSON.parse(serverText);
    if (json?.message && typeof json.message === "string" && json.message.length < 120) {
      return json.message;
    }
    if (json?.error && typeof json.error === "string" && json.error.length < 120) {
      return json.error;
    }
  } catch { /* not JSON */ }

  switch (status) {
    case 400: return "The request was invalid. Please check your input and try again.";
    case 401: return "Your session has expired. Please log in again.";
    case 403: return "You don't have permission to do that.";
    case 404: return "The requested resource was not found.";
    case 409: return "A conflict occurred — this item may already exist.";
    case 422: return "Some fields are invalid. Please review and try again.";
    case 429: return "Too many requests. Please wait a moment and try again.";
    case 500: return "Something went wrong on our end. Please try again shortly.";
    case 502:
    case 503:
    case 504: return "The server is temporarily unavailable. Please try again in a moment.";
    default:  return "An unexpected error occurred. Please try again.";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(friendlyHttpError(res.status, text));
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE_URL}${queryKey.join("/") as string}`, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
