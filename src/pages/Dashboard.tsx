import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, Users, Calendar, TrendingUp, Sparkles, LogOut, 
  Menu, Bell, Download, Plus, Clock, AlertTriangle,
  Shield, RefreshCw, ArrowRightLeft,
  UserCheck, ClipboardList, BarChart3, Settings, Home
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const fetchDashboardData = async (userId: string) => {
    // Fetch stats
    const [clientsRes, caregiversRes, shiftsRes] = await Promise.all([
      supabase.from("clients").select("*", { count: 'exact' }).eq("agency_id", userId).eq("is_active", true),
      supabase.from("caregivers").select("*", { count: 'exact' }).eq("agency_id", userId),
      supabase.from("shifts").select("*, clients(first_name, last_name)").eq("agency_id", userId)
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
      .eq("agency_id", userId)
      .eq("status", "open")
      .is("caregiver_id", null)
      .lte("shift_date", twoDaysFromNow.toISOString().split('T')[0])
      .order("shift_date", { ascending: true })
      .limit(3);

    setUrgentRequests((urgentShifts || []).map(shift => ({
      id: shift.id,
      client_name: `${shift.clients?.first_name || ''} ${shift.clients?.last_name || ''}`,
      care_type: shift.care_type,
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <Activity className="h-8 w-8" />
            <h1 className="text-2xl font-bold">CareMuch</h1>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground hover:bg-white/20"
              onClick={() => {
                navigate("/dashboard");
                setSidebarOpen(false);
              }}
            >
              <Home className="mr-3 h-5 w-5" />
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/schedule");
                setSidebarOpen(false);
              }}
            >
              <Calendar className="mr-3 h-5 w-5" />
              Schedule
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/caregivers");
                setSidebarOpen(false);
              }}
            >
              <Users className="mr-3 h-5 w-5" />
              Caregivers
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/clients");
                setSidebarOpen(false);
              }}
            >
              <UserCheck className="mr-3 h-5 w-5" />
              Clients
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/unassigned-shifts");
                setSidebarOpen(false);
              }}
            >
              <ClipboardList className="mr-3 h-5 w-5" />
              Care Orders
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/quick-assign");
                setSidebarOpen(false);
              }}
            >
              <Sparkles className="mr-3 h-5 w-5" />
              AI Matching
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/live-operations");
                setSidebarOpen(false);
              }}
            >
              <BarChart3 className="mr-3 h-5 w-5" />
              Reports
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => {
                navigate("/caregiver-approvals");
                setSidebarOpen(false);
              }}
            >
              <UserCheck className="mr-3 h-5 w-5" />
              Caregiver Approvals
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground/80 hover:bg-white/20"
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="mr-3 h-5 w-5" />
              Settings
            </Button>
          </nav>

          <div className="p-4 border-t border-white/20">
            <div className="text-center text-sm">
              <p className="font-medium">{profile?.full_name || user?.email}</p>
              <p className="text-primary-foreground/60">{profile?.role || 'Manager'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-30">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                <Badge variant="destructive" className="ml-1">5</Badge>
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm" onClick={() => navigate("/unassigned-shifts")}>
                <Plus className="h-4 w-4 mr-2" />
                New Care Order
              </Button>
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Active Clients</p>
                    <h3 className="text-3xl font-bold">{stats.activeClients}</h3>
                    <p className="text-xs text-muted-foreground mt-1">+3 this week</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Available Caregivers</p>
                    <h3 className="text-3xl font-bold">{stats.availableCaregivers}/{stats.totalCaregivers}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((stats.availableCaregivers / stats.totalCaregivers) * 100)}% availability
                    </p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg">
                    <UserCheck className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pending Orders</p>
                    <h3 className="text-3xl font-bold">{stats.pendingOrders}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
                  </div>
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Unfilled Shifts</p>
                    <h3 className="text-3xl font-bold">{stats.unfilledShifts}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Next 48 hours</p>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
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
          </div>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex items-start gap-4 p-3 border-b last:border-b-0 hover:bg-accent/50 rounded transition-colors">
                  <div className={`p-2 rounded-lg ${
                    notification.type === 'warning' ? 'bg-warning/10' :
                    notification.type === 'success' ? 'bg-success/10' :
                    notification.type === 'danger' ? 'bg-destructive/10' :
                    'bg-primary/10'
                  }`}>
                    {notification.type === 'warning' && <ArrowRightLeft className="h-4 w-4 text-warning" />}
                    {notification.type === 'success' && <RefreshCw className="h-4 w-4 text-success" />}
                    {notification.type === 'danger' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {notification.type === 'info' && <Bell className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <h6 className="font-semibold text-sm">{notification.title}</h6>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                  </div>
                  {notification.actionLabel && (
                    <Button size="sm" variant="outline">
                      {notification.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
