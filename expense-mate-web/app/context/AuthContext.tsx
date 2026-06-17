"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  userId: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  emailMfaEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshStatus = async (): Promise<User | null> => {
    try {
      const res = await fetch("/api/v1/auth/status", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const mappedUser: User = {
          userId: data.user_id,
          email: data.email,
          role: data.role,
          totpEnabled: data.totp_enabled,
          emailMfaEnabled: data.email_mfa_enabled,
        };
        setUser(mappedUser);
        return mappedUser;
      } else {
        setUser(null);
        return null;
      }
    } catch (error) {
      // Fail close - clear state on network or status error
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      // Quietly swallow logout errors, but proceed to clear client state
    } finally {
      setUser(null);
      // Clean up browser cache and force clear page state by full reload
      window.location.href = "/";
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
