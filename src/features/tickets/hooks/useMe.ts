import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../api/api';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 5 * 60_000,
  });
}

export const useCan = (permission: string) => useMe().data?.permissions.includes(permission) ?? false;
