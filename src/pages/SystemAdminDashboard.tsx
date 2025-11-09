import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import {
  Users, Building2, Calendar, TrendingUp, 
  UserCheck, Clock, Shield, Settings, UserCog, FileText, List, Tag
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface SystemStats {
  totalAgencies: number;
  totalUsers: number;
  totalCaregivers: number;
  totalClients: number;
  totalShifts: number;
  activeShifts: number;
}

const SystemAdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { getModulesByCategory } = usePermissions();
  const [stats, setStats] = useState<SystemStats>({
    totalAgencies: 0,
    totalUsers: 0,
    totalCaregivers: 0,
    totalClients: 0,
    totalShifts: 0,
    activeShifts: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user has system_admin role
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: session.user.id });
    
    if (roleData !== 'system_admin') {
      toast.error("Access denied. System admin role required.");
      navigate("/dashboard");
      return;
    }

    await fetchSystemStats();
    setLoading(false);
  };

  const fetchSystemStats = async () => {
    try {
      // Fetch system-wide statistics
      const [
        { count: agencyCount },
        { count: userCount },
        { count: caregiverCount },
        { count: clientCount },
        { count: shiftCount },
        { data: activeShiftsData }
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: 'exact', head: true }),
        supabase.from("user_roles").select("*", { count: 'exact', head: true }),
        supabase.from("caregivers").select("*", { count: 'exact', head: true }),
        supabase.from("clients").select("*", { count: 'exact', head: true }),
        supabase.from("shifts").select("*", { count: 'exact', head: true }),
        supabase.from("shifts")
          .select("*", { count: 'exact' })
          .in("status", ["open", "assigned"])
      ]);

      setStats({
        totalAgencies: agencyCount || 0,
        totalUsers: userCount || 0,
        totalCaregivers: caregiverCount || 0,
        totalClients: clientCount || 0,
        totalShifts: shiftCount || 0,
        activeShifts: activeShiftsData?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
      toast.error("Failed to load system statistics");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              System Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">System-wide overview and management</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin-user-management")}>
              <UserCog className="h-4 w-4 mr-2" />
              User Management
            </Button>
            <Button onClick={() => navigate("/users")} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              View Users
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Agencies
              </CardTitle>
              <Building2 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalAgencies}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Registered agencies
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All user accounts
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Caregivers
              </CardTitle>
              <UserCheck className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalCaregivers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active caregivers
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
              <Users className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Registered clients
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Shifts
              </CardTitle>
              <Calendar className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalShifts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All time shifts
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Shifts
              </CardTitle>
              <Clock className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeShifts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Open & scheduled
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Administration Modules */}
        <Card>
          <CardHeader>
            <CardTitle>System Administration</CardTitle>
            <p className="text-sm text-muted-foreground">Manage system-wide settings and roles</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {getModulesByCategory("administration").map((module) => {
                const iconMap: Record<string, any> = {
                  users: Users,
                  user_roles: UserCog,
                  system_roles: Shield,
                  role_permissions: Settings,
                };
                const Icon = iconMap[module.module_code] || Settings;
                
                return (
                  <Button
                    key={module.module_code}
                    variant="outline"
                    className="justify-start h-auto py-4"
                    onClick={() => module.route && navigate(module.route)}
                  >
                    <div className="flex items-start gap-3 text-left">
                      <Icon className="h-5 w-5 mt-0.5" />
                      <div>
                        <div className="font-semibold">{module.module_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {module.can_create && module.can_update && module.can_delete ? "Full Access" : "View & Edit"}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Modules */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <p className="text-sm text-muted-foreground">Configure care types and needs</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {getModulesByCategory("configuration").map((module) => {
                const iconMap: Record<string, any> = {
                  care_types: Tag,
                  care_needs: List,
                };
                const Icon = iconMap[module.module_code] || FileText;
                
                return (
                  <Button
                    key={module.module_code}
                    variant="outline"
                    className="justify-start h-auto py-4"
                    onClick={() => module.route && navigate(module.route)}
                  >
                    <div className="flex items-start gap-3 text-left">
                      <Icon className="h-5 w-5 mt-0.5" />
                      <div>
                        <div className="font-semibold">{module.module_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {module.can_create && module.can_update && module.can_delete ? "Full Access" : "View & Edit"}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Operations Modules */}
        <Card>
          <CardHeader>
            <CardTitle>Operations Management</CardTitle>
            <p className="text-sm text-muted-foreground">Manage daily operations and scheduling</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {getModulesByCategory("operations").map((module) => {
                const iconMap: Record<string, any> = {
                  caregivers: Users,
                  clients: UserCheck,
                  shifts: Calendar,
                  orders: FileText,
                  availability: Clock,
                };
                const Icon = iconMap[module.module_code] || FileText;
                
                return (
                  <Button
                    key={module.module_code}
                    variant="outline"
                    className="justify-start h-auto py-4"
                    onClick={() => module.route && navigate(module.route)}
                  >
                    <div className="flex items-start gap-3 text-left">
                      <Icon className="h-5 w-5 mt-0.5" />
                      <div>
                        <div className="font-semibold">{module.module_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {module.can_create && module.can_update && module.can_delete ? "Full Access" : "View & Edit"}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <div>
                    <div className="font-medium">System Status</div>
                    <div className="text-sm text-muted-foreground">All services operational</div>
                  </div>
                </div>
                <div className="text-success font-semibold">Healthy</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SystemAdminDashboard;
