import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson } from './client';

export interface Admin {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useCurrentAdmin() {
  const queryClient = useQueryClient();
  const [sessionRejected, setSessionRejected] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    if (sessionRejected) queryClient.removeQueries({ queryKey: ['auth', 'me'], exact: true });
  }, [queryClient, sessionRejected]);
  const query = useQuery({
    queryKey: ['auth', 'me'],
    enabled: !sessionRejected,
    queryFn: async () => {
      try {
        return parseAdmin(await getJson<unknown>('/auth/me'));
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setSessionExpired(error.code === 'SESSION_EXPIRED');
          setSessionRejected(true);
        }
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  return { ...query, sessionRejected, sessionExpired };
}

function parseAdmin(response: unknown): Admin {
  if (!response || typeof response !== 'object' || !('data' in response) || !response.data || typeof response.data !== 'object') throw invalidResponse();
  const admin = response.data as Record<string, unknown>;
  if (typeof admin.id !== 'string' || !admin.id || typeof admin.email !== 'string' || !admin.email || typeof admin.displayName !== 'string' || (typeof admin.avatarUrl !== 'string' && admin.avatarUrl !== null) || typeof admin.createdAt !== 'string' || typeof admin.updatedAt !== 'string') throw invalidResponse();
  return { id: admin.id, email: admin.email, displayName: admin.displayName.trim() || 'Quản trị viên', avatarUrl: admin.avatarUrl, createdAt: admin.createdAt, updatedAt: admin.updatedAt };
}

function invalidResponse(): ApiError {
  return new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
}
