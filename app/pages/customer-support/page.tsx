import AuthGuard from "@/app/lib/authguard";

export default function CustomerSupport() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        Customer Support
      </div>
    </AuthGuard>
  );
}
