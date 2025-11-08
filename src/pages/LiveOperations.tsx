import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle, MapPin, Phone, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";

interface LiveShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  clients: {
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    phone: string;
  };
  shift_assignments: {
    id: string;
    status: string;
    clock_in_time: string | null;
    clock_out_time: string | null;
    caregivers: {
      first_name: string;
      last_name: string;
      phone: string;
    };
  }[];
}

const LiveOperations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shifts, setShifts] = useState<LiveShift[]>([]);
  const [stats, setStats] = useState({
    activeShifts: 0,
    onBreak: 0,
    upcoming: 0,
    urgentGaps: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetch();
    
    // Set up real-time updates
    const channel = supabase
      .channel('live-operations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_assignments'
        },
        () => {
          fetchLiveShifts();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLiveShifts, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchLiveShifts();
  };

  const fetchLiveShifts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          clients (
            first_name,
            last_name,
            address,
            city,
            phone
          ),
          shift_assignments (
            id,
            status,
            clock_in_time,
            clock_out_time,
            caregivers (
              first_name,
              last_name,
              phone
            )
          )
        `)
        .eq("agency_id", user.id)
        .eq("shift_date", today)
        .order("start_time", { ascending: true });

      if (error) throw error;

      const shiftsData = data || [];
      setShifts(shiftsData);

      // Calculate stats
      let active = 0;
      let upcoming = 0;
      let gaps = 0;

      shiftsData.forEach((shift: any) => {
        if (shift.shift_assignments && shift.shift_assignments.length > 0) {
          const assignment = shift.shift_assignments[0];
          if (assignment.status === 'in_progress') {
            active++;
          } else if (assignment.status === 'scheduled' || assignment.status === 'confirmed') {
            upcoming++;
          }
        } else {
          gaps++;
        }
      });

      setStats({
        activeShifts: active,
        onBreak: 0,
        upcoming,
        urgentGaps: gaps
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      'scheduled': 'bg-accent/10 text-accent border-accent/20',
      'confirmed': 'bg-primary/10 text-primary border-primary/20',
      'in_progress': 'bg-success/10 text-success border-success/20',
      'completed': 'bg-muted text-muted-foreground',
      'no_show': 'bg-destructive/10 text-destructive border-destructive/20',
      'cancelled': 'bg-muted text-muted-foreground'
    };
    return colors[status] || 'bg-muted';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Live Operations</h1>
        <p className="text-muted-foreground mb-6">
          {format(new Date(), "EEEE, MMMM d, yyyy")} • Real-time monitoring
        </p>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-success">{stats.activeShifts}</div>
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming (1hr)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-accent">{stats.upcoming}</div>
                <Clock className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Break</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-warning">{stats.onBreak}</div>
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className={stats.urgentGaps > 0 ? "border-destructive" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Urgent Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${stats.urgentGaps > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {stats.urgentGaps}
                </div>
                {stats.urgentGaps > 0 && <AlertCircle className="h-8 w-8 text-destructive" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shifts List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Today's Schedule</h2>
          {shifts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No shifts scheduled for today</p>
              </CardContent>
            </Card>
          ) : (
            shifts.map((shift) => (
              <Card key={shift.id} className={!shift.shift_assignments || shift.shift_assignments.length === 0 ? "border-destructive" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">
                        {shift.clients.first_name} {shift.clients.last_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {shift.start_time} - {shift.end_time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {shift.clients.address}, {shift.clients.city}
                        </span>
                      </CardDescription>
                    </div>
                    {shift.shift_assignments && shift.shift_assignments.length > 0 ? (
                      <Badge variant="outline" className={getStatusColor(shift.shift_assignments[0].status)}>
                        {shift.shift_assignments[0].status.replace('_', ' ')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        UNASSIGNED
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {shift.shift_assignments && shift.shift_assignments.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {shift.shift_assignments[0].caregivers.first_name} {shift.shift_assignments[0].caregivers.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {shift.shift_assignments[0].caregivers.phone}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          {shift.shift_assignments[0].clock_in_time && (
                            <p className="text-success">
                              Clocked in: {format(new Date(shift.shift_assignments[0].clock_in_time), "h:mm a")}
                            </p>
                          )}
                          {shift.shift_assignments[0].clock_out_time && (
                            <p className="text-muted-foreground">
                              Clocked out: {format(new Date(shift.shift_assignments[0].clock_out_time), "h:mm a")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-destructive text-sm">⚠️ This shift needs coverage immediately</p>
                      <Button size="sm" variant="outline" className="border-primary">
                        Auto-Fill
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveOperations;
