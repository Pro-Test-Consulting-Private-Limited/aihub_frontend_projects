import { Suspense } from "react";
import ProjectGenerateDraft from ".";

export default function DebuggerPage() {
  return (
    <Suspense fallback={<div>Loading debugger...</div>}>
      <ProjectGenerateDraft />
    </Suspense>
  );
}
