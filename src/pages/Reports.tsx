import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3, TrendingUp, Users, Clock, Download, Calendar as CalendarIcon, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";

interface ReportStats {
  totalShifts: number;
  completedShifts: number;
  activeCaregivers: number;
  activeClients: number;
  totalHours: number;
  growthRate: number;
}

const Reports = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shiftData, setShiftData] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view reports");
        return;
      }

      // Fetch shifts data
      const { data: shifts, error: shiftsError } = await supabase
        .from("shifts")
        .select("*, shift_assignments(*)")
        .gte("shift_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("shift_date", format(dateRange.to, "yyyy-MM-dd"))
        .eq("agency_id", user.id);

      if (shiftsError) throw shiftsError;

      // Fetch caregivers
      const { data: caregivers, error: caregiversError } = await supabase
        .from("caregivers")
        .select("*")
        .eq("agency_id", user.id)
        .eq("is_active", true);

      if (caregiversError) throw caregiversError;

      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("agency_id", user.id)
        .eq("is_active", true);

      if (clientsError) throw clientsError;

      // Calculate stats
      const completedShifts = shifts?.filter(s => s.status === "completed").length || 0;
      const totalHours = shifts?.reduce((sum, s) => sum + (Number(s.duration_hours) || 0), 0) || 0;

      // Calculate growth rate (compare with previous period)
      const periodDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const prevFrom = subDays(dateRange.from, periodDays);
      const { data: prevShifts } = await supabase
        .from("shifts")
        .select("id")
        .gte("shift_date", format(prevFrom, "yyyy-MM-dd"))
        .lt("shift_date", format(dateRange.from, "yyyy-MM-dd"))
        .eq("agency_id", user.id);

      const growthRate = prevShifts && prevShifts.length > 0
        ? ((shifts?.length || 0) - prevShifts.length) / prevShifts.length * 100
        : 0;

      setStats({
        totalShifts: shifts?.length || 0,
        completedShifts,
        activeCaregivers: caregivers?.length || 0,
        activeClients: clients?.length || 0,
        totalHours,
        growthRate,
      });

      // Process shift data for charts
      const shiftsByDate = shifts?.reduce((acc: any, shift) => {
        const date = shift.shift_date;
        if (!acc[date]) {
          acc[date] = { date, count: 0, hours: 0 };
        }
        acc[date].count++;
        acc[date].hours += Number(shift.duration_hours) || 0;
        return acc;
      }, {});

      setShiftData(Object.values(shiftsByDate || {}).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ));

    } catch (error: any) {
      toast.error(error.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(","));
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  const chartConfig = {
    count: {
      label: "Shifts",
      color: "hsl(var(--primary))",
    },
    hours: {
      label: "Hours",
      color: "hsl(var(--secondary))",
    },
  };

  return (
    <AppLayout>
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Reports & Analytics</h1>
            <p className="text-muted-foreground">View comprehensive reports and analytics</p>
          </div>
          
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from && dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                    </>
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                  >
                    This month
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              onClick={() => exportToCSV(shiftData, "shift_report")}
              disabled={loading || shiftData.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {loading ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : stats ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <StatCard
                title="Total Shifts"
                value={stats.totalShifts}
                description={`${stats.completedShifts} completed`}
                icon={BarChart3}
                iconColor="text-primary"
              />
              <StatCard
                title="Active Caregivers"
                value={stats.activeCaregivers}
                icon={Users}
                iconColor="text-secondary"
              />
              <StatCard
                title="Hours This Period"
                value={stats.totalHours.toFixed(1)}
                description={`${stats.activeClients} active clients`}
                icon={Clock}
                iconColor="text-accent"
              />
              <StatCard
                title="Growth Rate"
                value={`${stats.growthRate > 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`}
                description="vs previous period"
                icon={TrendingUp}
                iconColor={stats.growthRate >= 0 ? "text-green-600" : "text-red-600"}
              />
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="shifts">Shifts</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Shift Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {shiftData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={shiftData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(value) => format(new Date(value), "MMM dd")}
                              className="text-xs"
                            />
                            <YAxis className="text-xs" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No shift data available for the selected period
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shifts" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Hours Worked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {shiftData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={shiftData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(value) => format(new Date(value), "MMM dd")}
                              className="text-xs"
                            />
                            <YAxis className="text-xs" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line 
                              type="monotone" 
                              dataKey="hours" 
                              stroke="var(--color-hours)" 
                              strokeWidth={2}
                              dot={{ fill: "var(--color-hours)" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No hours data available for the selected period
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Completion Rate</span>
                        <span className="text-lg font-bold">
                          {stats.totalShifts > 0 
                            ? `${((stats.completedShifts / stats.totalShifts) * 100).toFixed(1)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Avg Hours per Shift</span>
                        <span className="text-lg font-bold">
                          {stats.totalShifts > 0 
                            ? `${(stats.totalHours / stats.totalShifts).toFixed(1)} hrs`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Active Utilization</span>
                        <span className="text-lg font-bold">
                          {stats.activeCaregivers > 0 && stats.totalShifts > 0
                            ? `${((stats.completedShifts / stats.activeCaregivers)).toFixed(1)} shifts/caregiver`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
};

export default Reports;
