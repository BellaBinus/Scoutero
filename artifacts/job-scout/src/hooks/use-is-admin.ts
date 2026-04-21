import { useGetMe } from "@workspace/api-client-react";
import { useDevRole } from "@/contexts/dev-role-context";

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { data, isLoading } = useGetMe();
  const { simulateRegularUser } = useDevRole();
  const rawAdmin = data?.isAdmin ?? false;
  const isAdmin = rawAdmin && !(import.meta.env.DEV && simulateRegularUser);
  return { isAdmin, isLoading };
}
