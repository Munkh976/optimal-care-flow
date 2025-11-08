import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Mail, Phone, MapPin } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/AppLayout";

interface CaregiverRegistration {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  employment_type: string;
  hourly_rate: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason?: string | null;
  agency_id: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  availability?: any;
  updated_at?: string;
}

const CaregiverApprovals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<CaregiverRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; registrationId: string | null; reason: string }>({
    open: false,
    registrationId: null,
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
    fetchRegistrations();
  };

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from("caregiver_registrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRegistrations(data as CaregiverRegistration[] || []);
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

  const handleApprove = async (registration: CaregiverRegistration) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the auth user ID for this caregiver
      const { data: userData, error: userError } = await supabase.rpc('assign_caregiver_role', {
        caregiver_email: registration.email
      });

      if (userError) throw userError;

      // Create caregiver in caregivers table
      const { error: caregiverError } = await supabase.from("caregivers").insert({
        email: registration.email,
        phone: registration.phone,
        first_name: registration.first_name,
        last_name: registration.last_name,
        address: registration.address,
        city: registration.city,
        state: registration.state,
        zip_code: registration.zip_code,
        employment_type: registration.employment_type,
        hourly_rate: registration.hourly_rate,
        agency_id: user.id,
        is_active: true,
      });

      if (caregiverError) throw caregiverError;

      // Update registration status
      const { error: updateError } = await supabase
        .from("caregiver_registrations")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", registration.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Caregiver approved and added to your team",
      });
      fetchRegistrations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.registrationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("caregiver_registrations")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectDialog.reason,
        })
        .eq("id", rejectDialog.registrationId);

      if (error) throw error;

      toast({
        title: "Registration Rejected",
        description: "The applicant has been notified",
      });
      setRejectDialog({ open: false, registrationId: null, reason: "" });
      fetchRegistrations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "bg-warning/10 text-warning border-warning/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return <Badge variant="outline" className={variants[status]}>{status}</Badge>;
  };

  const filteredRegistrations = registrations.filter(reg => {
    if (filter === 'all') return true;
    return reg.status === filter;
  });

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Caregiver Applications</h1>
            <p className="text-muted-foreground">Review and approve caregiver registrations</p>
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
              variant={filter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('approved')}
            >
              Approved
            </Button>
            <Button
              variant={filter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('rejected')}
            >
              Rejected
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredRegistrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No applications found</p>
              </CardContent>
            </Card>
          ) : (
            filteredRegistrations.map((registration) => (
              <Card key={registration.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">
                        {registration.first_name} {registration.last_name}
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4" />
                          {registration.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4" />
                          {registration.phone}
                        </div>
                        {registration.city && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4" />
                            {registration.city}, {registration.state} {registration.zip_code}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    {getStatusBadge(registration.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium mb-1">Employment Type</p>
                      <p className="text-muted-foreground capitalize">{registration.employment_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Desired Rate</p>
                      <p className="text-muted-foreground">${registration.hourly_rate}/hr</p>
                    </div>
                  </div>

                  {registration.rejection_reason && (
                    <div className="bg-destructive/10 p-3 rounded-lg">
                      <p className="font-medium text-sm text-destructive mb-1">Rejection Reason</p>
                      <p className="text-sm text-muted-foreground">{registration.rejection_reason}</p>
                    </div>
                  )}

                  {registration.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="bg-success hover:bg-success/90 text-white"
                        onClick={() => handleApprove(registration)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => setRejectDialog({ open: true, registrationId: registration.id, reason: "" })}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejection. This will be shared with the applicant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Rejection</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason..."
                  value={rejectDialog.reason}
                  onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog({ open: false, registrationId: null, reason: "" })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectDialog.reason.trim()}>
                Reject Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CaregiverApprovals;
