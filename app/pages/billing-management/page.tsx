import AuthGuard from "@/app/lib/authguard";

export default function BillingManagement() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        Billing Management
      </div>
    </AuthGuard>
  );
}
