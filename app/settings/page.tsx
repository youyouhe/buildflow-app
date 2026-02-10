"use client";

import { ApiKeysSettings } from "@/components/settings/api-keys";
import { McpServersSettings } from "@/components/settings/mcp-servers";
import { useUser } from "@/hooks/useUser";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen overflow-y-auto bg-black">
      <div className="max-w-4xl mx-auto py-12 px-4 pb-24">
        <header className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 -ml-2 text-neutral-400 hover:text-white">
              <ArrowLeft className="size-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-neutral-400">
            Manage your API keys and preferences
          </p>
        </header>

        <div className="space-y-6">
          <ApiKeysSettings />
          <McpServersSettings />
        </div>
      </div>
    </div>
  );
}
