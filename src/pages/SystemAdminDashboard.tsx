import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import {
  Users, Building2, Calendar, TrendingUp, 
  UserCheck, Clock, Shield
} from "lucide-react";

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
          <Button onClick={() => navigate("/users")}>
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Button>
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate("/users")}
              >
                <div className="flex items-start gap-3 text-left">
                  <Users className="h-5 w-5 mt-0.5" />
                  <div>
                    <div className="font-semibold">Manage Users</div>
                    <div className="text-xs text-muted-foreground">
                      View and edit all user accounts
                    </div>
                  </div>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate("/users/add")}
              >
                <div className="flex items-start gap-3 text-left">
                  <UserCheck className="h-5 w-5 mt-0.5" />
                  <div>
                    <div className="font-semibold">Add New User</div>
                    <div className="text-xs text-muted-foreground">
                      Create new user accounts
                    </div>
                  </div>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate("/caregiver-approvals")}
              >
                <div className="flex items-start gap-3 text-left">
                  <Clock className="h-5 w-5 mt-0.5" />
                  <div>
                    <div className="font-semibold">Caregiver Approvals</div>
                    <div className="text-xs text-muted-foreground">
                      Review pending registrations
                    </div>
                  </div>
                </div>
              </Button>
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
