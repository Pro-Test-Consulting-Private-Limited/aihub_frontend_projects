import AuthGuard from "@/app/lib/authguard";

export default function Domain() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">Domain</div>
    </AuthGuard>
  );
}
