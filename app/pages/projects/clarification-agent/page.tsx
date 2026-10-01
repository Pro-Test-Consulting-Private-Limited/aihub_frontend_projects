import { Suspense } from "react";
import RequirementClarificationAgent from ".";

export default function ClarificationAgentPage() {
  return (
    <Suspense fallback={<div>Loading clarification agent...</div>}>
      <RequirementClarificationAgent />
    </Suspense>
  );
}