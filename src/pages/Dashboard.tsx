import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import {
  Users, Clock, AlertTriangle, UserCheck, CalendarDays,
  Sparkles, ArrowRightLeft, Shield, Plus, ClipboardList, BadgeCheck
} from "lucide-react";

interface Stats {
  activeClients: number;
  availableCaregivers: number;
  totalCaregivers: number;
  todayShifts: number;
  todayUnassigned: number;
  weekUnassigned: number;
  activeOrders: number;
  pendingTimeOff: number;
  pendingTrades: number;
  expiringCerts: number;
  coverageRate: number;
}

interface UrgentRequest {
  id: string;
  client_name: string;
  care_type: string;
  shift_date: string;
  start_time: string;
}

interface ActionItem {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  actionLabel: string;
  to: string;
}

const iso = (d: Date) => d.toISOString().split("T")[0];

const Dashboard = () => {
  const navigate = useNavigate();
  const { pendingCount } = usePendingApprovals();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    activeClients: 0,
    availableCaregivers: 0,
    totalCaregivers: 0,
    todayShifts: 0,
    todayUnassigned: 0,
    weekUnassigned: 0,
    activeOrders: 0,
    pendingTimeOff: 0,
    pendingTrades: 0,
    expiringCerts: 0,
    coverageRate: 100,
  });
  const [urgentRequests, setUrgentRequests] = useState<UrgentRequest[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

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
    // Get user's agency from profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .single();

    if (!profileData?.agency_id) return;

    const agencyId = profileData.agency_id;
    const today = iso(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    const [clientsRes, caregiversRes, weekShiftsRes, ordersRes, timeOffRes, tradesRes, certsRes] =
      await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true })
          .eq("agency_id", agencyId).eq("is_active", true),
        supabase.from("caregivers").select("id, is_active").eq("agency_id", agencyId),
        supabase.from("shifts").select("id, shift_date, status, caregiver_id")
          .eq("agency_id", agencyId).gte("shift_date", today).lte("shift_date", iso(weekEnd)),
        supabase.from("client_orders").select("id", { count: "exact", head: true })
          .eq("agency_id", agencyId).is("archived_at", null).neq("status", "completed"),
        supabase.from("time_off_requests").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("shift_trades").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("caregiver_certifications").select("id", { count: "exact", head: true })
          .lte("expiry_date", iso(in30)).gte("expiry_date", today),
      ]);

    const caregivers = caregiversRes.data || [];
    const weekShifts = weekShiftsRes.data || [];
    const todays = weekShifts.filter((s: any) => s.shift_date === today);
    const todayUnassigned = todays.filter((s: any) => !s.caregiver_id).length;
    const weekUnassigned = weekShifts.filter((s: any) => !s.caregiver_id).length;

    setStats({
      activeClients: clientsRes.count || 0,
      availableCaregivers: caregivers.filter((c: any) => c.is_active).length,
      totalCaregivers: caregivers.length,
      todayShifts: todays.length,
      todayUnassigned,
      weekUnassigned,
      activeOrders: ordersRes.count || 0,
      pendingTimeOff: timeOffRes.count || 0,
      pendingTrades: tradesRes.count || 0,
      expiringCerts: certsRes.count || 0,
      coverageRate: weekShifts.length
        ? Math.round(((weekShifts.length - weekUnassigned) / weekShifts.length) * 100)
        : 100,
    });

    // Fetch urgent requests (open shifts within next 48 hours)
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    
    const { data: urgentShifts } = await supabase
      .from("shifts")
      .select("id, shift_date, start_time, care_type_code, order_title, clients(first_name, last_name), care_types(name)")
      .eq("agency_id", agencyId)
      .is("caregiver_id", null)
      .gte("shift_date", today)
      .lte("shift_date", twoDaysFromNow.toISOString().split('T')[0])
      .order("shift_date", { ascending: true })
      .limit(5);

    setUrgentRequests((urgentShifts || []).map((shift: any) => ({
      id: shift.id,
      client_name: `${shift.clients?.first_name || ''} ${shift.clients?.last_name || ''}`,
      care_type: shift.care_types?.name || shift.order_title || shift.care_type_code,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
    })));

    const items: ActionItem[] = [];
    if (weekUnassigned > 0) {
      items.push({
        id: "unassigned",
        type: "danger",
        title: `${weekUnassigned} unassigned shift${weekUnassigned === 1 ? "" : "s"}`,
        message: "Shifts in the next 7 days still need a caregiver.",
        actionLabel: "Fill shifts",
        to: "/schedule?tab=unassigned",
      });
    }
    if ((timeOffRes.count || 0) > 0) {
      items.push({
        id: "timeoff",
        type: "warning",
        title: `${timeOffRes.count} time-off request${timeOffRes.count === 1 ? "" : "s"} pending`,
        message: "Approve or deny to keep the schedule accurate.",
        actionLabel: "Review",
        to: "/time-off-requests",
      });
    }
    if ((tradesRes.count || 0) > 0) {
      items.push({
        id: "trades",
        type: "warning",
        title: `${tradesRes.count} shift trade${tradesRes.count === 1 ? "" : "s"} pending`,
        message: "Caregivers are waiting on a coverage decision.",
        actionLabel: "Review",
        to: "/shift-trades",
      });
    }
    if ((certsRes.count || 0) > 0) {
      items.push({
        id: "certs",
        type: "danger",
        title: `${certsRes.count} certification${certsRes.count === 1 ? "" : "s"} expiring`,
        message: "Expiring within the next 30 days.",
        actionLabel: "View caregivers",
        to: "/caregivers",
      });
    }
    setActionItems(items);
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
            <Button size="sm" variant="outline" onClick={() => navigate("/schedule?tab=today")}>
              <CalendarDays className="h-4 w-4 mr-2" />
              Today's Board
            </Button>
            <Button size="sm" onClick={() => navigate("/order-management")}>
              <Plus className="h-4 w-4 mr-2" />
              New Care Order
            </Button>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pendingCount > 0 && (
            <button type="button" onClick={() => navigate("/caregiver-approvals")} className="text-left">
              <StatCard
                title="Caregiver Applications"
                value={pendingCount}
                description="Awaiting your approval"
                icon={UserCheck}
                iconColor="text-warning"
              />
            </button>
          )}
          <button type="button" onClick={() => navigate("/schedule?tab=today")} className="text-left">
            <StatCard
              title="Today's Shifts"
              value={stats.todayShifts}
              description={`${stats.todayUnassigned} still unassigned`}
              icon={CalendarDays}
              iconColor="text-primary"
            />
          </button>
          <button type="button" onClick={() => navigate("/schedule?tab=unassigned")} className="text-left">
            <StatCard
              title="Unassigned (7 days)"
              value={stats.weekUnassigned}
              description={`${stats.coverageRate}% coverage this week`}
              icon={AlertTriangle}
              iconColor="text-destructive"
            />
          </button>
          <button type="button" onClick={() => navigate("/order-management")} className="text-left">
            <StatCard
              title="Active Orders"
              value={stats.activeOrders}
              description="Not completed or archived"
              icon={ClipboardList}
              iconColor="text-warning"
            />
          </button>
          <button type="button" onClick={() => navigate("/caregivers")} className="text-left">
            <StatCard
              title="Active Caregivers"
              value={`${stats.availableCaregivers}/${stats.totalCaregivers}`}
              description={`${stats.activeClients} active clients`}
              icon={UserCheck}
              iconColor="text-success"
            />
          </button>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate("/schedule?tab=unassigned")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Assign Shifts
              </Button>
              <Button variant="outline" onClick={() => navigate("/shift-trades")}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Shift Trades
                {stats.pendingTrades > 0 && (
                  <Badge variant="secondary" className="ml-2">{stats.pendingTrades}</Badge>
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate("/time-off-requests")}>
                <Shield className="mr-2 h-4 w-4" />
                Time Off
                {stats.pendingTimeOff > 0 && (
                  <Badge variant="secondary" className="ml-2">{stats.pendingTimeOff}</Badge>
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate("/care-types")}>
                <BadgeCheck className="mr-2 h-4 w-4" />
                Care Services & Categories
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
              <CardTitle>Needs Your Attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All caught up — nothing needs your attention.
                </p>
              ) : (
                actionItems.map((item) => (
                  <div key={item.id} className={`p-3 rounded-lg border-l-4 ${
                    item.type === 'danger' ? 'border-l-destructive bg-destructive/5' :
                    item.type === 'warning' ? 'border-l-warning bg-warning/5' :
                    'border-l-primary bg-primary/5'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h6 className="font-semibold text-sm">{item.title}</h6>
                        <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(item.to)}>
                        {item.actionLabel}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
