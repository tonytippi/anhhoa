export type ParentContext = {
  schoolId: string;
  schoolName: string;
  student: { id: string; fullName: string };
};
export type Session = {
  audience: "parent";
  userIdentityId: string;
  email: string;
  schools: ParentContext[];
};
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfCookieName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "parent_csrf"
    : __CSRF_COOKIE_NAME__;
export const googleLoginUrl = `${apiUrl}/api/parent/auth/google/start`;
function csrfToken(): string | undefined {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${csrfCookieName}=`))
    ?.slice(csrfCookieName.length + 1);
}
export async function bootstrapSession(
  clear: () => void,
  signal?: AbortSignal,
): Promise<Session | undefined> {
  try {
    const response = await fetch(`${apiUrl}/api/parent/auth/session`, {
      credentials: "include",
      signal,
      cache: "no-store",
    });
    if (!response.ok) {
      clear();
      return undefined;
    }
    return ((await response.json()) as { data: Session }).data;
  } catch {
    if (!signal?.aborted) clear();
    return undefined;
  }
}
export async function logout(clear: () => void): Promise<void> {
  clear();
  const token = csrfToken();
  await fetch(`${apiUrl}/api/parent/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: token ? { "x-csrf-token": decodeURIComponent(token) } : {},
  }).catch(() => undefined);
}
export type ParentGetResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "aborted" }
  | { kind: "auth" }
  | { kind: "denied" }
  | { kind: "error" };
export type ParentMutationResult<T> =
  | ParentGetResult<T>
  | { kind: "validation"; fieldErrors: Record<string, string> }
  | { kind: "unknown" };
export async function parentGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<ParentGetResult<T>> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      signal,
      cache: "no-store",
    });
    if (response.ok)
      return {
        kind: "ok",
        data: ((await response.json()) as { data: T }).data,
      };
    if (response.status === 401 || response.status === 403)
      return { kind: "auth" };
    return response.status === 404 ? { kind: "denied" } : { kind: "error" };
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "error" };
  }
}
export async function parentMedia(
  path: string,
  signal?: AbortSignal,
): Promise<ParentGetResult<Blob>> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      signal,
      cache: "no-store",
    });
    if (response.ok) return { kind: "ok", data: await response.blob() };
    if (response.status === 401 || response.status === 403)
      return { kind: "auth" };
    return response.status === 404 ? { kind: "denied" } : { kind: "error" };
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "error" };
  }
}
export async function parentPost<T>(
  path: string,
  signal?: AbortSignal,
): Promise<ParentGetResult<T>> {
  try {
    const token = csrfToken();
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      credentials: "include",
      signal,
      cache: "no-store",
      headers: token ? { "x-csrf-token": decodeURIComponent(token) } : {},
    });
    if (response.ok)
      return {
        kind: "ok",
        data: ((await response.json()) as { data: T }).data,
      };
    if (response.status === 401 || response.status === 403)
      return { kind: "auth" };
    return response.status === 404 ? { kind: "denied" } : { kind: "error" };
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "error" };
  }
}
export async function parentMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  idempotencyKey: string,
  operationId: string,
  signal?: AbortSignal,
): Promise<ParentMutationResult<T>> {
  try {
    const token = csrfToken();
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      credentials: "include",
      signal,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-operation-id": operationId,
        ...(token ? { "x-csrf-token": decodeURIComponent(token) } : {}),
      },
      body: JSON.stringify(body),
    });
    if (response.ok)
      return {
        kind: "ok",
        data: ((await response.json()) as { data: T }).data,
      };
    if (response.status === 401 || response.status === 403)
      return { kind: "auth" };
    if (response.status === 404) return { kind: "denied" };
    if ([408, 429, 500, 502, 503, 504].includes(response.status))
      return { kind: "unknown" };
    if (response.status === 400 || response.status === 409) {
      const responseBody = (await response.json().catch(() => null)) as {
        error?: { fieldErrors?: Record<string, string> };
        fieldErrors?: Record<string, string>;
      } | null;
      const fieldErrors =
        responseBody?.error?.fieldErrors ?? responseBody?.fieldErrors;
      if (fieldErrors) return { kind: "validation", fieldErrors };
    }
    return { kind: "error" };
  } catch {
    return signal?.aborted ? { kind: "aborted" } : { kind: "unknown" };
  }
}

export async function parentLeaveMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  idempotencyKey: string,
  operationId: string,
  signal?: AbortSignal,
): Promise<ParentMutationResult<T>> {
  const result = await parentMutation<{ outcome: T }>(
    path,
    method,
    body,
    idempotencyKey,
    operationId,
    signal,
  );
  if (result.kind !== "ok") return result;
  return { kind: "ok", data: result.data.outcome };
}
