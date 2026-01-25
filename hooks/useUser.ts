/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCookie } from "react-use";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { User } from "@/types";
import { toast } from "sonner";
import { useBroadcastChannel } from "@/lib/useBroadcastChannel";
import { initiateGitHubLogin, getGitHubUser, isValidToken } from "@/lib/github/auth";


export const useUser = () => {
  const client = useQueryClient();
  const router = useRouter();
  const [, setCurrentRoute, removeCurrentRoute] = useCookie("buildflow-currentRoute");
  const [token, setToken, removeToken] = useCookie("github_token");
  const hasValidatedToken = useRef(false);

  // Proactively clear invalid tokens on mount
  useEffect(() => {
    if (!hasValidatedToken.current && token && !isValidToken(token)) {
      console.log("[useUser] Clearing invalid token on mount");
      removeToken();
      hasValidatedToken.current = true;
    } else if (!hasValidatedToken.current) {
      hasValidatedToken.current = true;
    }
  }, [token, removeToken]);

  const { data: user = null, isLoading, refetch: refetchMe } =
    useQuery({
      queryKey: ["user.me"],
      queryFn: async () => {
        if (!token || !isValidToken(token)) {
          console.log("[useUser] No valid token found", { hasToken: !!token, isValid: isValidToken(token) });
          // Clear invalid token
          if (token) {
            removeToken();
          }
          return null;
        }

        try {
          const userData = await getGitHubUser(token);
          return userData;
        } catch (error) {
          console.error("[useUser] Failed to fetch user:", error);
          // If the token is invalid, clear it
          if (error instanceof Error && error.message.includes("401")) {
            console.log("[useUser] Token is invalid (401), clearing...");
            removeToken();
          }
          return null;
        }
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      enabled: !!token && isValidToken(token),
    });

  const { data: loadingAuth } = useQuery({
    queryKey: ["loadingAuth"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  
  const setLoadingAuth = (value: boolean) => {
    client.setQueryData(["loadingAuth"], value);
  };

  // Listen for OAuth callback from popup window
  useBroadcastChannel("auth", (message: any) => {
    if (message.type === "github-oauth" && message.token) {
      handleLoginSuccess(message.token);
    }
  });

  const isInIframe = () => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  };

  const openLoginWindow = async () => {
    setCurrentRoute(window.location.pathname);
    
    const loginUrl = initiateGitHubLogin();
    
    // If in iframe, open OAuth in popup window
    if (isInIframe()) {
      try {
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        window.open(
          loginUrl,
          "BuildFlow - GitHub Authentication",
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
        return;
      } catch (error) {
        console.error("Failed to open login popup:", error);
        toast.error("Failed to open login window");
      }
    }
    
    // Default: redirect to GitHub OAuth
    window.location.href = loginUrl;
  };

  const handleLoginSuccess = (accessToken: string) => {
    setLoadingAuth(true);
    
    try {
      const expiresIn = 60 * 60 * 24 * 365; // 1 year
      const expiresDate = new Date();
      expiresDate.setTime(expiresDate.getTime() + expiresIn * 1000);
      
      const isProduction = window.location.protocol === 'https:';
      
      const cookieOptions: any = {
        expires: expiresDate,
        path: '/',
        sameSite: isProduction ? 'none' : 'lax',
      };
      
      if (isProduction) {
        cookieOptions.secure = true;
      }
      
      setToken(accessToken, cookieOptions);
      
      const cookieString = `github_token=${accessToken}; path=/; max-age=${expiresIn}; samesite=${isProduction ? 'none' : 'lax'}${cookieOptions.secure ? '; secure' : ''}`;
      document.cookie = cookieString;
      
      refetchMe();
      router.push("/");
      toast.success("Login successful");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to complete login");
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async () => {
    removeToken();
    removeCurrentRoute();
    toast.success("Logout successful");
    client.clear();
    window.location.reload();
  };

  return {
    user,
    loading: isLoading || loadingAuth,
    openLoginWindow,
    handleLoginSuccess,
    token,
    logout,
  };
};
