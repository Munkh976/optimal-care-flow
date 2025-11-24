import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, Clock } from "lucide-react";

const DashboardStats = () => {
  const [stats, setStats] = useState({
    totalCaregivers: 0,
    activeCaregivers: 0,
    totalShifts: 0,
    openShifts: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's agency from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();

      if (!profileData?.agency_id) return;
      const agencyId = profileData.agency_id;

      // Fetch caregivers count
      const { count: totalCaregivers } = await supabase
        .from("caregivers")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId);

      const { count: activeCaregivers } = await supabase
        .from("caregivers")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("is_active", true);

      // Fetch shifts count for this week
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { count: totalShifts } = await supabase
        .from("shifts")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .gte("shift_date", weekStart.toISOString().split("T")[0])
        .lte("shift_date", weekEnd.toISOString().split("T")[0]);

      const { count: openShifts } = await supabase
        .from("shifts")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("status", "open")
        .gte("shift_date", new Date().toISOString().split("T")[0]);

      setStats({
        totalCaregivers: totalCaregivers || 0,
        activeCaregivers: activeCaregivers || 0,
        totalShifts: totalShifts || 0,
        openShifts: openShifts || 0,
      });
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Active Caregivers",
      value: stats.activeCaregivers,
      subtitle: `${stats.totalCaregivers} total`,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "This Week's Shifts",
      value: stats.totalShifts,
      subtitle: "Scheduled shifts",
      icon: Calendar,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Open Shifts",
      value: stats.openShifts,
      subtitle: "Need assignment",
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Fill Rate",
      value: stats.totalShifts > 0 ? `${Math.round(((stats.totalShifts - stats.openShifts) / stats.totalShifts) * 100)}%` : "0%",
      subtitle: "Weekly performance",
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats;