import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Users, Clock, AlertTriangle, UserCheck, 
  Sparkles, ArrowRightLeft, Shield, Plus
} from "lucide-react";

interface Stats {
  activeClients: number;
  availableCaregivers: number;
  totalCaregivers: number;
  pendingOrders: number;
  unfilledShifts: number;
}

interface UrgentRequest {
  id: string;
  client_name: string;
  care_type: string;
  shift_date: string;
  start_time: string;
}

interface Notification {
  id: string;
  type: 'warning' | 'success' | 'danger' | 'info';
  title: string;
  message: string;
  time: string;
  actionLabel?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    activeClients: 0,
    availableCaregivers: 0,
    totalCaregivers: 0,
    pendingOrders: 0,
    unfilledShifts: 0,
  });
  const [urgentRequests, setUrgentRequests] = useState<UrgentRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      await fetchDashboardData(session.user.id);
    }

    setLoading(false);
  };

  const refreshData = async () => {
    if (user) {
      await fetchDashboardData(user.id);
    }
  };

  const fetchDashboardData = async (userId: string) => {
    // Get user's agency from profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .single();

    if (!profileData?.agency_id) return;

    const agencyId = profileData.agency_id;

    // Fetch stats
    const [clientsRes, caregiversRes, shiftsRes] = await Promise.all([
      supabase.from("clients").select("*", { count: 'exact' }).eq("agency_id", agencyId).eq("is_active", true),
      supabase.from("caregivers").select("*", { count: 'exact' }).eq("agency_id", agencyId),
      supabase.from("shifts").select("*, clients(first_name, last_name)").eq("agency_id", agencyId)
    ]);

    const activeCaregivers = caregiversRes.data?.filter(c => c.is_active).length || 0;
    const openShifts = shiftsRes.data?.filter(s => s.status === 'open' && !s.caregiver_id).length || 0;
    const unassignedShifts = shiftsRes.data?.filter(s => s.status === 'unassigned').length || 0;

    setStats({
      activeClients: clientsRes.count || 0,
      availableCaregivers: activeCaregivers,
      totalCaregivers: caregiversRes.count || 0,
      pendingOrders: unassignedShifts,
      unfilledShifts: openShifts,
    });

    // Fetch urgent requests (open shifts within next 48 hours)
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    
    const { data: urgentShifts } = await supabase
      .from("shifts")
      .select("*, clients(first_name, last_name)")
      .eq("agency_id", agencyId)
      .eq("status", "open")
      .is("caregiver_id", null)
      .lte("shift_date", twoDaysFromNow.toISOString().split('T')[0])
      .order("shift_date", { ascending: true })
      .limit(3);

    setUrgentRequests((urgentShifts || []).map(shift => ({
      id: shift.id,
      client_name: `${shift.clients?.first_name || ''} ${shift.clients?.last_name || ''}`,
      care_type: shift.care_type_code,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
    })));

    // Create mock notifications (you can replace with real data)
    setNotifications([
      {
        id: '1',
        type: 'warning',
        title: 'Shift Trade Request',
        message: 'A caregiver has requested to trade a shift',
        time: '5 minutes ago',
        actionLabel: 'Review'
      },
      {
        id: '2',
        type: 'success',
        title: 'Schedule Confirmed',
        message: "Next week's schedule has been confirmed by all caregivers",
        time: '1 hour ago'
      },
      {
        id: '3',
        type: 'danger',
        title: 'Certification Expiring',
        message: "A caregiver's certification expires in 7 days",
        time: '2 hours ago',
        actionLabel: 'Action Required'
      }
    ]);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'quick-assign':
        navigate("/quick-assign");
        break;
      case 'shift-trades':
        navigate("/shift-trades");
        break;
      case 'compliance':
        toast.info("Compliance check coming soon!");
        break;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {profile?.full_name || user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => navigate("/order-management")}>
              <Plus className="h-4 w-4 mr-2" />
              New Care Order
            </Button>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Clients"
            value={stats.activeClients}
            description="+3 this week"
            icon={Users}
            iconColor="text-primary"
          />
          <StatCard
            title="Available Caregivers"
            value={`${stats.availableCaregivers}/${stats.totalCaregivers}`}
            description={`${Math.round((stats.availableCaregivers / Math.max(stats.totalCaregivers, 1)) * 100)}% availability`}
            icon={UserCheck}
            iconColor="text-success"
          />
          <StatCard
            title="Pending Orders"
            value={stats.pendingOrders}
            description="Requires attention"
            icon={Clock}
            iconColor="text-warning"
          />
          <StatCard
            title="Unfilled Shifts"
            value={stats.unfilledShifts}
            description="Next 48 hours"
            icon={AlertTriangle}
            iconColor="text-destructive"
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => handleQuickAction('quick-assign')}>
                <Sparkles className="mr-2 h-4 w-4" />
                Quick Assign
              </Button>
              <Button variant="outline" onClick={() => handleQuickAction('shift-trades')}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                View Shift Trades
              </Button>
              <Button variant="outline" onClick={() => handleQuickAction('compliance')}>
                <Shield className="mr-2 h-4 w-4" />
                Compliance Check
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Urgent Requests */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Urgent Care Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {urgentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No urgent requests</p>
              ) : (
                urgentRequests.map((request) => (
                  <div key={request.id} className="border-l-4 border-destructive bg-destructive/5 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h6 className="font-semibold">{request.client_name}</h6>
                        <p className="text-sm text-muted-foreground">{request.care_type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {new Date(request.shift_date).toLocaleDateString()} at {request.start_time}
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => navigate(`/quick-assign?shift=${request.id}`)}>
                        Assign
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className={`p-3 rounded-lg border-l-4 ${
                  notif.type === 'danger' ? 'border-l-destructive bg-destructive/5' :
                  notif.type === 'warning' ? 'border-l-warning bg-warning/5' :
                  notif.type === 'success' ? 'border-l-success bg-success/5' :
                  'border-l-primary bg-primary/5'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h6 className="font-semibold text-sm">{notif.title}</h6>
                      <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">{notif.time}</p>
                    </div>
                    {notif.actionLabel && (
                      <Button size="sm" variant="outline">
                        {notif.actionLabel}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
