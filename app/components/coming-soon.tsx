import AuthGuard from "@/app/lib/authguard";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <div className="text-[22px] font-[500] text-[#081332] dark:text-[#ededed] mb-2">
          {title}
        </div>
        <p className="text-[14px] text-[#7E7E7E] dark:text-[#9ca3af]">
          This section is coming soon.
        </p>
      </div>
    </AuthGuard>
  );
}
