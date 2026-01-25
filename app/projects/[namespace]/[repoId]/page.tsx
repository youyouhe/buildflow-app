"use client";

import { AppEditor } from "@/components/editor";
import { use } from "react";

export default function ProjectNamespacePage({
  params,
}: {
  params: Promise<{ namespace: string; repoId: string }>;
}) {
  const { namespace, repoId } = use(params);
  return <AppEditor namespace={namespace} repoId={repoId} />;
}
