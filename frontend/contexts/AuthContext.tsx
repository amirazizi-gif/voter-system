"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ⏰ SESSION CONFIGURATION
const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

interface User {
  id: string;
  username: string;
  role: string;
  dun: string | null;
  full_name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  mustChangePassword: boolean;
  setMustChangePassword: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const router = useRouter();

  // ✅ CHECK SESSION ON MOUNT
  useEffect(() => {
    checkSession();
  }, []);

  // ⏰ CHECK SESSION EXPIRATION EVERY MINUTE
  useEffect(() => {
    const interval = setInterval(() => {
      checkSessionExpiration();
    }, 60000); // Check every 1 minute

    return () => clearInterval(interval);
  }, []);

  const checkSession = () => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const storedMustChange = localStorage.getItem("must_change_password");
    const loginTime = localStorage.getItem("login_time");

    if (storedToken && storedUser && loginTime) {
      const now = new Date().getTime();
      const sessionAge = now - parseInt(loginTime);

      // Check if session has expired (3 days)
      if (sessionAge > SESSION_DURATION) {
        console.log("⏰ Session expired (3 days), logging out...");
        handleSessionExpired();
        return;
      }

      // Session is valid
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        setMustChangePassword(storedMustChange === "true");
        console.log(`✅ Session valid, expires in ${Math.floor((SESSION_DURATION - sessionAge) / (1000 * 60 * 60))} hours`);
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        handleSessionExpired();
      }
    }
    setIsLoading(false);
  };

  const checkSessionExpiration = () => {
    const loginTime = localStorage.getItem("login_time");
    
    if (loginTime) {
      const now = new Date().getTime();
      const sessionAge = now - parseInt(loginTime);

      if (sessionAge > SESSION_DURATION) {
        console.log("⏰ Session expired during check, logging out...");
        handleSessionExpired();
      }
    }
  };

  const handleSessionExpired = () => {
    // Clear all stored data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("must_change_password");
    localStorage.removeItem("login_time");
    
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    
    // Show alert
    alert("⏰ Sesi anda telah tamat tempoh. Sila log masuk semula.\n\nYour session has expired. Please login again.");
    
    // Redirect to login
    router.push("/login");
  };

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    const loginUrl = `${API_BASE_URL}/api/auth/login`;

    console.log("🔐 Attempting login...");

    try {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        let errorMessage = "Login failed";
        try {
          const error = await response.json();
          errorMessage = error.detail || errorMessage;
        } catch (e) {
          errorMessage = `Login failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Login successful!");

      // Store login time for session expiration
      const loginTime = new Date().getTime().toString();
      
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("login_time", loginTime);

      // Store password change flag
      const mustChange = data.must_change_password || false;
      localStorage.setItem("must_change_password", mustChange.toString());

      setToken(data.access_token);
      setUser(data.user);
      setMustChangePassword(mustChange);

      console.log(`🎉 Login complete, session expires in 3 days`);

      return mustChange;
    } catch (error) {
      console.error("❌ Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    console.log("👋 Logging out...");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("must_change_password");
    localStorage.removeItem("login_time");
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    router.push("/login");
  };

  // ✅ GET SESSION INFO (for debugging or display)
  const getSessionInfo = () => {
    const loginTime = localStorage.getItem("login_time");
    if (!loginTime) return null;

    const now = new Date().getTime();
    const sessionAge = now - parseInt(loginTime);
    const remainingTime = SESSION_DURATION - sessionAge;
    
    return {
      loginTime: new Date(parseInt(loginTime)),
      sessionAge: sessionAge,
      remainingTime: remainingTime,
      expiresAt: new Date(parseInt(loginTime) + SESSION_DURATION),
      isExpired: remainingTime <= 0
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        mustChangePassword,
        setMustChangePassword,
      }}
    >
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