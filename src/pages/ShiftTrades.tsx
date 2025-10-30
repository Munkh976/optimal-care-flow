import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Calendar, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface ShiftTrade {
  id: string;
  reason: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  trade_type: 'trade_board' | 'direct_trade' | 'agency_coverage';
  surge_pay_amount: number;
  created_at: string;
  shift_assignments: {
    shift_id: string;
    shifts: {
      shift_date: string;
      start_time: string;
      end_time: string;
      clients: {
        first_name: string;
        last_name: string;
        city: string;
      };
    };
  };
  original_caregivers: {
    first_name: string;
    last_name: string;
  };
  new_caregivers: {
    first_name: string;
    last_name: string;
  } | null;
}

const ShiftTrades = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [trades, setTrades] = useState<ShiftTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    checkAuthAndFetch();
    
    // Set up real-time updates
    const channel = supabase
      .channel('shift-trades')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_trades'
        },
        () => {
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchTrades();
  };

  const fetchTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("shift_trades")
        .select(`
          *,
          shift_assignments!inner (
            shift_id,
            shifts!inner (
              shift_date,
              start_time,
              end_time,
              agency_id,
              clients (
                first_name,
                last_name,
                city
              )
            )
          ),
          original_caregivers:caregivers!shift_trades_original_caregiver_id_fkey (
            first_name,
            last_name
          ),
          new_caregivers:caregivers!shift_trades_new_caregiver_id_fkey (
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter by agency_id through the shift relationship
      const filteredData = (data || []).filter((trade: any) => 
        trade.shift_assignments?.shifts?.agency_id === user.id
      );
      
      setTrades(filteredData);
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

  const handleAccept = async (tradeId: string) => {
    const { error } = await supabase
      .from("shift_trades")
      .update({ 
        status: "accepted",
        resolved_at: new Date().toISOString()
      })
      .eq("id", tradeId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Trade accepted successfully",
      });
      fetchTrades();
    }
  };

  const handleDecline = async (tradeId: string) => {
    const { error } = await supabase
      .from("shift_trades")
      .update({ 
        status: "declined",
        resolved_at: new Date().toISOString()
      })
      .eq("id", tradeId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Trade declined",
      });
      fetchTrades();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "bg-warning/10 text-warning border-warning/20",
      accepted: "bg-success/10 text-success border-success/20",
      declined: "bg-destructive/10 text-destructive border-destructive/20",
      cancelled: "bg-muted text-muted-foreground",
      expired: "bg-muted text-muted-foreground"
    };
    return <Badge variant="outline" className={variants[status]}>{status}</Badge>;
  };

  const getTradeTypeBadge = (type: string) => {
    const labels: any = {
      trade_board: "Trade Board",
      direct_trade: "Direct Trade",
      agency_coverage: "Agency Coverage"
    };
    return <Badge variant="secondary">{labels[type]}</Badge>;
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'all') return true;
    if (filter === 'pending') return trade.status === 'pending';
    if (filter === 'completed') return ['accepted', 'declined', 'cancelled'].includes(trade.status);
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Shift Trade Board</h1>
              <p className="text-muted-foreground">Manage shift trades and coverage requests</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('completed')}
            >
              Completed
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredTrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No shift trades found</p>
              </CardContent>
            </Card>
          ) : (
            filteredTrades.map((trade) => (
              <Card key={trade.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">
                        Shift Trade Request
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(trade.shift_assignments.shifts.shift_date), "MMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {trade.shift_assignments.shifts.start_time} - {trade.shift_assignments.shifts.end_time}
                          </span>
                        </div>
                        <p className="text-sm">
                          Client: {trade.shift_assignments.shifts.clients.first_name} {trade.shift_assignments.shifts.clients.last_name}
                          {" • "}
                          {trade.shift_assignments.shifts.clients.city}
                        </p>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(trade.status)}
                      {getTradeTypeBadge(trade.trade_type)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium mb-1">Original Caregiver</p>
                      <p className="text-muted-foreground">
                        {trade.original_caregivers.first_name} {trade.original_caregivers.last_name}
                      </p>
                    </div>
                    {trade.new_caregivers && (
                      <div>
                        <p className="font-medium mb-1">New Caregiver</p>
                        <p className="text-muted-foreground">
                          {trade.new_caregivers.first_name} {trade.new_caregivers.last_name}
                        </p>
                      </div>
                    )}
                  </div>

                  {trade.reason && (
                    <div>
                      <p className="font-medium text-sm mb-1">Reason</p>
                      <p className="text-sm text-muted-foreground">{trade.reason}</p>
                    </div>
                  )}

                  {trade.surge_pay_amount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="font-medium">Surge Pay: ${trade.surge_pay_amount}</span>
                    </div>
                  )}

                  {trade.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success/20 hover:bg-success/10"
                        onClick={() => handleAccept(trade.id)}
                      >
                        Accept Trade
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => handleDecline(trade.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftTrades;
