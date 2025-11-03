import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  status: string;
  order_title: string;
  special_notes: string | null;
  caregiver_id: string | null;
}

interface MyScheduleProps {
  clientId: string | null;
}

export const MySchedule = ({ clientId }: MyScheduleProps) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'week' | 'month'>('week');

  useEffect(() => {
    if (clientId) {
      fetchShifts();
    }
  }, [clientId]);

  const fetchShifts = async () => {
    if (!clientId) return;

    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30); // Next 30 days

      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("client_id", clientId)
        .gte("shift_date", today.toISOString().split('T')[0])
        .lte("shift_date", endDate.toISOString().split('T')[0])
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      toast.error("Failed to load schedule");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: { variant: "outline", label: "Unassigned" },
      assigned: { variant: "secondary", label: "Assigned" },
      confirmed: { variant: "default", label: "Confirmed" },
      completed: { variant: "secondary", label: "Completed" }
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const groupShiftsByDate = () => {
    const grouped: Record<string, Shift[]> = {};
    shifts.forEach(shift => {
      if (!grouped[shift.shift_date]) {
        grouped[shift.shift_date] = [];
      }
      grouped[shift.shift_date].push(shift);
    });
    return grouped;
  };

  const groupedShifts = groupShiftsByDate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">My Schedule</h2>
        <p className="text-sm text-muted-foreground">View your upcoming care sessions</p>
      </div>

      {Object.keys(groupedShifts).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No upcoming shifts</p>
            <p className="text-sm text-muted-foreground">Your schedule will appear here once orders are processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedShifts).map(([date, dateShifts]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
              </div>
              <div className="grid gap-3">
                {dateShifts.map((shift) => (
                  <Card key={shift.id} className="hover-scale">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{shift.order_title}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {shift.start_time} - {shift.end_time} ({shift.duration_hours}h)
                          </CardDescription>
                        </div>
                        {getStatusBadge(shift.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {shift.caregiver_id && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Caregiver assigned</span>
                        </div>
                      )}
                      {shift.special_notes && (
                        <p className="text-sm text-muted-foreground border-l-2 border-primary/50 pl-3">
                          {shift.special_notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
