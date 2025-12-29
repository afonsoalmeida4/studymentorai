import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AppUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  language?: string;
  displayName?: string;
  totalXp?: number;
  currentLevel?: string;
  premiumActive?: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsSessionLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data: user, isLoading: isUserLoading } = useQuery<AppUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      if (!session?.access_token) {
        return null;
      }

      const response = await fetch("/api/auth/user", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error("Failed to fetch user");
      }

      return response.json();
    },
    enabled: !!session?.access_token,
    retry: false,
  });

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  }, []);

  const signup = useCallback(async (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: metadata?.firstName,
          last_name: metadata?.lastName,
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    queryClient.clear();
  }, [queryClient]);

  const loginWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  return {
    user,
    session,
    isLoading: isSessionLoading || (!!session && isUserLoading),
    isAuthenticated: !!session && !!user,
    login,
    signup,
    logout,
    loginWithGoogle,
    getAccessToken,
  };
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}
