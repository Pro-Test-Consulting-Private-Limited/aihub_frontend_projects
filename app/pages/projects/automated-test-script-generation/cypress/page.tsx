import { Suspense } from "react";
import ProjectAutomatedTestScriptGenerationSelenium from ".";

export default function DebuggerPage() {
  return (
    <Suspense fallback={<div>Loading debugger...</div>}>
      <ProjectAutomatedTestScriptGenerationSelenium />
    </Suspense>
  );
}
