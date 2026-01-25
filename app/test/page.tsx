"use client";

import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function TestPage() {
  const { user, loading, openLoginWindow, logout } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center">BuildFlow Test Page</h1>

        <div className="border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
            <p className="text-sm text-muted-foreground">Testing GitHub OAuth integration</p>
          </div>

          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {user.avatar_url && (
                  <img 
                    src={user.avatar_url} 
                    alt={user.name} 
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div>
                  <p className="text-lg font-semibold">{user.name || user.login}</p>
                  <p className="text-sm text-muted-foreground">@{user.login}</p>
                  {user.email && (
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  )}
                </div>
              </div>

              {user.bio && (
                <div>
                  <p className="text-sm text-muted-foreground">{user.bio}</p>
                </div>
              )}

              <Button onClick={logout} variant="outline" className="w-full">
                Logout
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">You are not logged in.</p>
              <Button onClick={openLoginWindow} className="w-full">
                Login with GitHub
              </Button>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auth Status:</span>
              <span className="font-medium">{user ? "✅ Authenticated" : "❌ Not authenticated"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono">{user?.id || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GitHub Login:</span>
              <span className="font-mono">{user?.login || "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>This is a test page for BuildFlow development.</p>
          <p className="mt-2">Version 1.0.0 • GitHub OAuth Integration</p>
        </div>
      </div>
    </div>
  );
}
