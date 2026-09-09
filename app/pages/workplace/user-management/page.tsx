import AuthGuard from "@/app/lib/authguard";

export default function UserManagement() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        User Management
      </div>
    </AuthGuard>
  );
}
