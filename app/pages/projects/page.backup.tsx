import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectBreadcrumbs } from "@/app/constants/projects";
import AuthGuard from "@/app/lib/authguard";

export default function Projects() {
  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs breadcrumbs={ProjectBreadcrumbs} />
      </div>
    </AuthGuard>
  );
}
