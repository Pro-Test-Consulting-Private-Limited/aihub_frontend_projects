import AuthGuard from "@/app/lib/authguard";

export default function FinancialReports() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        Financial Reports
      </div>
    </AuthGuard>
  );
}
