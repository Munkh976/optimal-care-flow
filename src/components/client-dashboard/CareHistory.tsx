import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompletedShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  order_title: string;
  special_notes: string | null;
  status: string;
}

interface CareHistoryProps {
  clientId: string | null;
}

export const CareHistory = ({ clientId }: CareHistoryProps) => {
  const [completedShifts, setCompletedShifts] = useState<CompletedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    if (clientId) {
      fetchCareHistory();
    }
  }, [clientId]);

  const fetchCareHistory = async () => {
    if (!clientId) return;

    try {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "completed")
        .order("shift_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      setCompletedShifts(data || []);
      const total = (data || []).reduce((sum, shift) => sum + (shift.duration_hours || 0), 0);
      setTotalHours(total);
    } catch (error: any) {
      toast.error("Failed to load care history");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupByMonth = () => {
    const grouped: Record<string, CompletedShift[]> = {};
    completedShifts.forEach(shift => {
      const date = new Date(shift.shift_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(shift);
    });
    return grouped;
  };

  const groupedShifts = groupByMonth();

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
        <h2 className="text-2xl font-bold">Care History</h2>
        <p className="text-sm text-muted-foreground">Review your past care sessions</p>
      </div>

      {/* Stats Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Total Care Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{totalHours.toFixed(1)} hours</div>
          <p className="text-sm text-muted-foreground mt-1">{completedShifts.length} completed sessions</p>
        </CardContent>
      </Card>

      {completedShifts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No completed sessions yet</p>
            <p className="text-sm text-muted-foreground">Your care history will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedShifts).map(([monthKey, monthShifts]) => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            });
            const monthHours = monthShifts.reduce((sum, shift) => sum + (shift.duration_hours || 0), 0);

            return (
              <div key={monthKey} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{monthName}</h3>
                  </div>
                  <Badge variant="outline">{monthHours.toFixed(1)} hours</Badge>
                </div>
                <div className="grid gap-3">
                  {monthShifts.map((shift) => (
                    <Card key={shift.id} className="hover-scale">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{shift.order_title}</CardTitle>
                            <CardDescription className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(shift.shift_date).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {shift.start_time} - {shift.end_time}
                              </span>
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed
                          </Badge>
                        </div>
                      </CardHeader>
                      {shift.special_notes && (
                        <CardContent>
                          <p className="text-sm text-muted-foreground border-l-2 border-primary/50 pl-3">
                            {shift.special_notes}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
