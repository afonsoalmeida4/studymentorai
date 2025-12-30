import { useEffect, useState, useCallback, useRef } from "react";
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
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('[AUTH] Error getting session:', error);
          setSession(null);
          lastTokenRef.current = null;
        } else {
          setSession(session);
          lastTokenRef.current = session?.access_token || null;
        }
      } catch (e) {
        console.error('[AUTH] Init error:', e);
        if (isMounted) {
          setSession(null);
          lastTokenRef.current = null;
        }
      } finally {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      
      const newToken = newSession?.access_token || null;
      const tokenChanged = newToken !== lastTokenRef.current;
      
      if (!tokenChanged && _event !== 'SIGNED_OUT') {
        return;
      }
      
      console.log('[AUTH] Auth state changed:', _event, newSession?.user?.email);
      lastTokenRef.current = newToken;
      setSession(newSession);
      setIsSessionLoading(false);
      
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
        queryParams: {
          prompt: "select_account",
        },
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

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    // First verify current password by attempting to sign in
    const currentEmail = session?.user?.email;
    if (!currentEmail) {
      throw new Error("No active session");
    }

    // Check if user is OAuth user (Google)
    const provider = session?.user?.app_metadata?.provider;
    if (provider === "google") {
      throw new Error("Cannot change password for Google accounts");
    }

    // Verify current password
    const { data: signInData, error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });

    if (verifyError) {
      throw new Error("Current password is incorrect");
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw updateError;
    }

    // Re-authenticate with the new password to get a fresh session
    const { data: newLoginData, error: newLoginError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: newPassword,
    });

    if (newLoginError) {
      console.error('[AUTH] Failed to re-authenticate after password change:', newLoginError);
      // Session might be invalid, but password was changed successfully
      // The onAuthStateChange listener will handle session updates
    } else if (newLoginData?.session) {
      setSession(newLoginData.session);
      lastTokenRef.current = newLoginData.session.access_token;
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  }, [session, queryClient]);

  const updateEmail = useCallback(async (currentPassword: string, newEmail: string) => {
    // First verify current password
    const currentEmail = session?.user?.email;
    if (!currentEmail) {
      throw new Error("No active session");
    }

    // Check if user is OAuth user (Google)
    const provider = session?.user?.app_metadata?.provider;
    if (provider === "google") {
      throw new Error("Cannot change email for Google accounts");
    }

    // Verify current password
    const { data: signInData, error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });

    if (verifyError) {
      throw new Error("Current password is incorrect");
    }

    // Update email - Supabase will send confirmation to new email
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (updateError) {
      throw updateError;
    }

    // Refresh session after email change request
    const { data: refreshData } = await supabase.auth.getSession();
    if (refreshData?.session) {
      setSession(refreshData.session);
      lastTokenRef.current = refreshData.session.access_token;
    }
  }, [session]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });

    if (error) {
      throw error;
    }
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
    updatePassword,
    updateEmail,
    resetPassword,
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
