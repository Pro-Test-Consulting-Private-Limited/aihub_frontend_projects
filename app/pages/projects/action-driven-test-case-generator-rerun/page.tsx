import { Suspense } from "react";
import ProjectActionDrivenTestCaseGeneration from ".";

export default function DebuggerPage() {
  return (
    <Suspense fallback={<div>Loading debugger...</div>}>
      <ProjectActionDrivenTestCaseGeneration />
    </Suspense>
  );
}
