"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// Use environment variable for API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Debug logging
console.log("🔍 AuthContext API_BASE_URL:", API_BASE_URL);
console.log("🔍 Environment variable:", process.env.NEXT_PUBLIC_API_URL);

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

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const storedMustChange = localStorage.getItem("must_change_password");

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        setMustChangePassword(storedMustChange === "true");
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    const loginUrl = `${API_BASE_URL}/api/auth/login`;

    console.log("🔐 Attempting login...");
    console.log("📍 API URL:", loginUrl);
    console.log("👤 Username:", username);

    try {
      console.log("📡 Sending fetch request...");

      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      console.log("📥 Response received");
      console.log("📊 Status:", response.status);
      console.log("📊 Status Text:", response.statusText);
      console.log("📊 OK:", response.ok);

      if (!response.ok) {
        let errorMessage = "Login failed";
        try {
          const error = await response.json();
          errorMessage = error.detail || errorMessage;
          console.error("❌ Error response:", error);
        } catch (e) {
          console.error("❌ Failed to parse error response:", e);
          errorMessage = `Login failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Login successful!");
      console.log("👤 User:", data.user);
      console.log("🔒 Must change password:", data.must_change_password);

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Store password change flag
      const mustChange = data.must_change_password || false;
      localStorage.setItem("must_change_password", mustChange.toString());

      setToken(data.access_token);
      setUser(data.user);
      setMustChangePassword(mustChange);

      console.log("🎉 Login complete, must_change_password:", mustChange);

      // Return the must_change_password flag so caller knows
      return mustChange;
    } catch (error) {
      console.error("❌ Login error:", error);

      // More detailed error logging
      if (error instanceof TypeError) {
        console.error("🔴 TypeError - This usually means:");
        console.error("   1. Network request failed (CORS, network issue)");
        console.error("   2. API URL is incorrect:", loginUrl);
        console.error("   3. Backend is not accessible");
        console.error("   4. Mixed content (HTTP vs HTTPS)");
      }

      throw error;
    }
  };

  const logout = () => {
    console.log("👋 Logging out...");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("must_change_password");
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    router.push("/login");
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
