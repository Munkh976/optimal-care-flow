import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, XCircle, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/AppLayout";

interface TimeOffRequest {
  id: string;
  caregiver_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  request_type: 'vacation' | 'medical' | 'personal' | 'emergency';
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  notes: string | null;
  created_at: string;
  caregivers: {
    first_name: string;
    last_name: string;
  };
}

const TimeOffRequests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [caregivers, setCaregivers] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    caregiver_id: "",
    start_date: "",
    end_date: "",
    request_type: "vacation",
    reason: ""
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchRequests();
    fetchCaregivers();
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select(`
          *,
          caregivers (
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
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

  const fetchCaregivers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("caregivers")
      .select("id, first_name, last_name")
      .eq("agency_id", user.id)
      .eq("is_active", true);

    if (!error && data) {
      setCaregivers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.caregiver_id || !formData.start_date || !formData.end_date) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    
    const { error } = await supabase
      .from("time_off_requests")
      .insert([{
        caregiver_id: formData.caregiver_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        request_type: formData.request_type as 'vacation' | 'medical' | 'personal' | 'emergency',
        reason: formData.reason,
        status: "pending" as const
      }]);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Time off request created successfully",
      });
      setIsDialogOpen(false);
      setFormData({
        caregiver_id: "",
        start_date: "",
        end_date: "",
        request_type: "vacation",
        reason: ""
      });
      fetchRequests();
    }
  };

  const handleApprove = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("time_off_requests")
      .update({ status: "approved", approved_by_user_id: user?.id })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Request approved",
      });
      fetchRequests();
    }
  };

  const handleDeny = async (id: string) => {
    const { error } = await supabase
      .from("time_off_requests")
      .update({ status: "denied" })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Request denied",
      });
      fetchRequests();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "bg-warning/10 text-warning border-warning/20",
      approved: "bg-success/10 text-success border-success/20",
      denied: "bg-destructive/10 text-destructive border-destructive/20",
      cancelled: "bg-muted text-muted-foreground"
    };
    return <Badge variant="outline" className={variants[status]}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return <Badge variant="secondary">{type}</Badge>;
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Time Off Requests</h1>
            <p className="text-muted-foreground mt-1">Manage caregiver time off requests</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Time Off Request</DialogTitle>
                <DialogDescription>Submit a new time off request for a caregiver</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="caregiver">Caregiver</Label>
                    <Select
                      value={formData.caregiver_id}
                      onValueChange={(value) => setFormData({ ...formData, caregiver_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select caregiver" />
                      </SelectTrigger>
                      <SelectContent>
                        {caregivers.map((cg) => (
                          <SelectItem key={cg.id} value={cg.id}>
                            {cg.first_name} {cg.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="request_type">Request Type</Label>
                    <Select
                      value={formData.request_type}
                      onValueChange={(value) => setFormData({ ...formData, request_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="Brief explanation..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Request</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No time off requests found</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {request.caregivers.first_name} {request.caregivers.last_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(request.status)}
                      {getTypeBadge(request.request_type)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {request.reason && (
                    <p className="text-sm text-muted-foreground mb-4">{request.reason}</p>
                  )}
                  {request.notes && (
                    <p className="text-sm text-muted-foreground mb-4 italic">Note: {request.notes}</p>
                  )}
                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success/20 hover:bg-success/10"
                        onClick={() => handleApprove(request.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => handleDeny(request.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Deny
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

export default TimeOffRequests;
