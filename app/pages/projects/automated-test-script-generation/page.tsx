import { Suspense } from "react";
import ProjectAutomatedTestScriptGeneration from ".";

export default function DebuggerPage() {
  return (
    <Suspense fallback={<div>Loading debugger...</div>}>
      <ProjectAutomatedTestScriptGeneration />
    </Suspense>
  );
}
