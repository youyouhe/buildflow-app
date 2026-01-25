/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMount } from "react-use";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";

import { useUser } from "@/hooks/useUser";
import { User } from "@/types";
import { useBroadcastChannel } from "@/lib/useBroadcastChannel";

export default function AppContext({
  children,
}: {
  children: React.ReactNode;
}) {
  const { handleLoginSuccess, user, logout, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const events: any = {};

  useBroadcastChannel("auth", (message) => {
    if (pathname.includes("/auth/callback")) return;

    if (!message.token) return;
    if (message.type === "github-oauth" && message?.token && !events.token) {
      handleLoginSuccess(message.token);
    }
  });

  return children;
}
