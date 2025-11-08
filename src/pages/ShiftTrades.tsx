import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Calendar, Clock, DollarSign, MapPin, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";

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
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Shift Trade Board</h1>
          <p className="text-muted-foreground mt-1">Browse and claim available shift trades</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{trades.filter(t => t.status === 'pending').length}</p>
                <p className="text-sm text-muted-foreground mt-1">Available Shifts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-warning">{trades.filter(t => t.surge_pay_amount > 0 && t.status === 'pending').length}</p>
                <p className="text-sm text-muted-foreground mt-1">With Surge Pay</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-success">{trades.filter(t => t.status === 'accepted').length}</p>
                <p className="text-sm text-muted-foreground mt-1">Accepted</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-muted-foreground">{trades.filter(t => t.status === 'declined').length}</p>
                <p className="text-sm text-muted-foreground mt-1">Declined</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All Shifts
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pending')}
              >
                Available
              </Button>
              <Button
                variant={filter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('completed')}
              >
                Completed
              </Button>
            </div>
          </CardContent>
        </Card>

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
              <Card 
                key={trade.id} 
                className={`transition-all hover:shadow-lg ${
                  trade.surge_pay_amount > 0 && trade.status === 'pending'
                    ? 'border-l-4 border-l-warning bg-gradient-to-r from-warning/5 to-transparent'
                    : trade.status === 'pending'
                    ? 'hover:border-primary/20'
                    : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      {trade.surge_pay_amount > 0 && trade.status === 'pending' && (
                        <Badge className="bg-gradient-to-r from-warning to-warning/80 text-warning-foreground mb-2">
                          <DollarSign className="h-3 w-3 mr-1" />
                          +${trade.surge_pay_amount}/hr Surge Pay
                        </Badge>
                      )}
                      <CardTitle className="text-xl">
                        {format(new Date(trade.shift_assignments.shifts.shift_date), "EEEE, MMMM d")}
                      </CardTitle>
                      <CardDescription className="space-y-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {trade.shift_assignments.shifts.start_time} - {trade.shift_assignments.shifts.end_time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {trade.shift_assignments.shifts.clients.city}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Client:</span> {trade.shift_assignments.shifts.clients.first_name} {trade.shift_assignments.shifts.clients.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Posted by: {trade.original_caregivers.first_name} {trade.original_caregivers.last_name}
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(trade.status)}
                      {getTradeTypeBadge(trade.trade_type)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {trade.reason && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-medium text-sm mb-1">Reason for Trade</p>
                      <p className="text-sm text-muted-foreground">{trade.reason}</p>
                    </div>
                  )}

                  {trade.new_caregivers && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">
                        Claimed by: {trade.new_caregivers.first_name} {trade.new_caregivers.last_name}
                      </Badge>
                    </div>
                  )}

                  {trade.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                        onClick={() => handleAccept(trade.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Claim This Shift
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

export default ShiftTrades;
