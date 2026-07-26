import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PlatformData {
  roleCounts: { role: string; count: number }[];
  usersWithoutRole: number;
  caregiversWithoutLogin: number;
  clientsWithoutLogin: number;
  registrations: { pending: number; approved: number; rejected: number };
  modules: number;
  permissionRows: number;
}

export const PlatformAnalytics = () => {
  const [data, setData] = useState<PlatformData | null>(null);

  useEffect(() => {
    const load = async () => {
      const [roles, profiles, caregivers, clients, regs, modules, perms] = await Promise.all([
        supabase.from("user_roles").select("role,user_id"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("caregivers").select("user_id"),
        supabase.from("clients").select("user_id"),
        supabase.from("caregiver_registrations").select("status"),
        supabase.from("system_modules").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("role_permissions").select("id", { count: "exact", head: true }),
      ]);

      const roleRows = roles.data ?? [];
      const roleMap = new Map<string, number>();
      roleRows.forEach((r: any) => roleMap.set(r.role, (roleMap.get(r.role) ?? 0) + 1));

      const regRows = regs.data ?? [];
      const countStatus = (s: string) => regRows.filter((r: any) => r.status === s).length;

      setData({
        roleCounts: Array.from(roleMap, ([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
        usersWithoutRole: Math.max((profiles.count ?? 0) - new Set(roleRows.map((r: any) => r.user_id)).size, 0),
        caregiversWithoutLogin: (caregivers.data ?? []).filter((c: any) => !c.user_id).length,
        clientsWithoutLogin: (clients.data ?? []).filter((c: any) => !c.user_id).length,
        registrations: { pending: countStatus("pending"), approved: countStatus("approved"), rejected: countStatus("rejected") },
        modules: modules.count ?? 0,
        permissionRows: perms.count ?? 0,
      });
    };
    load();
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts by role</CardTitle>
          <CardDescription>Platform-wide role assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.roleCounts.length === 0 && <p className="text-sm text-muted-foreground">No roles assigned</p>}
          {data.roleCounts.map((r) => (
            <div key={r.role} className="flex items-center justify-between text-sm">
              <span className="capitalize">{r.role.replace(/_/g, " ")}</span>
              <Badge variant="secondary">{r.count}</Badge>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">Accounts without a role</span>
            <Badge variant={data.usersWithoutRole > 0 ? "destructive" : "secondary"}>{data.usersWithoutRole}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Records without a login</CardTitle>
          <CardDescription>Operational records not linked to an account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Caregivers</span>
            <Badge variant={data.caregiversWithoutLogin > 0 ? "destructive" : "secondary"}>{data.caregiversWithoutLogin}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Clients</span>
            <Badge variant={data.clientsWithoutLogin > 0 ? "outline" : "secondary"}>{data.clientsWithoutLogin}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registration funnel</CardTitle>
          <CardDescription>Self-registered caregiver applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Pending</span>
            <Badge variant={data.registrations.pending > 0 ? "destructive" : "secondary"}>{data.registrations.pending}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Approved</span>
            <Badge variant="secondary">{data.registrations.approved}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Rejected</span>
            <Badge variant="secondary">{data.registrations.rejected}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration coverage</CardTitle>
          <CardDescription>Modules and permission rules</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Active modules</span>
            <Badge variant="secondary">{data.modules}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Permission rules</span>
            <Badge variant="secondary">{data.permissionRows}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
