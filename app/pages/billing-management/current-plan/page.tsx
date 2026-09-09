import AuthGuard from "@/app/lib/authguard";

export default function CurrentPlan() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">Current Plan</div>
    </AuthGuard>
  );
}
