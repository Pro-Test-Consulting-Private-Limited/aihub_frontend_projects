import { Suspense } from "react";
import ProjectDebugger from ".";

export default function DebuggerPage() {
  return (
    <Suspense fallback={<div>Loading debugger...</div>}>
      <ProjectDebugger />
    </Suspense>
  );
}
