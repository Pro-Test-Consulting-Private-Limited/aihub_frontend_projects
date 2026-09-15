import { Suspense } from "react";
import ProjectAutomatedTestScriptGeneration from ".";

export default function DebuggerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProjectAutomatedTestScriptGeneration />
    </Suspense>
  );
}
