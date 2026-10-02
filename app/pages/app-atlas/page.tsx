"use client";

import { Suspense } from "react";
import AuthGuard from "@/app/lib/authguard";
import AtlasWorkspace from "@/app/components/app-atlas/atlas-workspace";

export default function AppAtlasPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <AtlasWorkspace />
      </Suspense>
    </AuthGuard>
  );
}
