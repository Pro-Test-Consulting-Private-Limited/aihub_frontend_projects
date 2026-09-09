import Breadcrumbs from "@/app/components/breadcrumbs";
import { MetricsBusinessUsageBreadcrumbs } from "@/app/constants/metrics";
import AuthGuard from "@/app/lib/authguard";

export default function Metrics() {
  return (
    <AuthGuard>
      <Breadcrumbs breadcrumbs={MetricsBusinessUsageBreadcrumbs} />

      <div className="p-6 pb-[4.5rem]">Metrics</div>
    </AuthGuard>
  );
}
