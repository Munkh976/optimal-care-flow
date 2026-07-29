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
import { usePermissions } from "@/hooks/usePermissions";
import { ScreeningResultDialog, ScreeningSession } from "@/components/caregivers/ScreeningResultDialog";
import { BAND_LABELS, ScoreBand } from "@/lib/flowEngine";
import { ClipboardList } from "lucide-react";

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
  const { userRole, hasPermission } = usePermissions();
  const [registrations, setRegistrations] = useState<CaregiverRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string | null } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [screenings, setScreenings] = useState<Record<string, ScreeningSession>>({});
  const [openScreening, setOpenScreening] = useState<CaregiverRegistration | null>(null);
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

      const ids = (data || []).map((r: any) => r.id);
      if (ids.length) {
        const { data: sessions } = await supabase
          .from("conversation_sessions")
          .select("id, registration_id, status, total_score, band, trait_scores, completed_at, started_at")
          .in("registration_id", ids)
          .order("completed_at", { ascending: false });
        const map: Record<string, ScreeningSession> = {};
        (sessions || []).forEach((s: any) => {
          if (s.registration_id && !map[s.registration_id]) map[s.registration_id] = s as ScreeningSession;
        });
        setScreenings(map);
      }
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
    setProcessingId(registration.id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-caregiver-registration", {
        body: { registrationId: registration.id, action: "approve" },
      });
      if (error) throw new Error((await (error as any)?.context?.text?.()) || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);

      setCredentials({ email: registration.email, password: (data as any)?.tempPassword ?? null });
      toast({
        title: "Caregiver approved",
        description: "Their login is active and they were added to your team",
      });
      fetchRegistrations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.registrationId) return;

    try {
      const { data, error } = await supabase.functions.invoke("approve-caregiver-registration", {
        body: {
          registrationId: rejectDialog.registrationId,
          action: "reject",
          rejectionReason: rejectDialog.reason,
        },
      });
      if (error) throw new Error((await (error as any)?.context?.text?.()) || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: "Registration Rejected",
        description: "A notice was recorded in the notification outbox",
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
  const canReviewApplications =
    !!userRole &&
    ["agency_admin", "manager", "hr_staff"].includes(userRole) &&
    hasPermission("caregiver_approvals", "update");

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

                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    {screenings[registration.id] ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Assistant screening</span>
                          <Badge
                            variant={
                              screenings[registration.id].band === "strong_fit" ? "default" : "secondary"
                            }
                          >
                            {screenings[registration.id].band
                              ? BAND_LABELS[screenings[registration.id].band as ScoreBand] ??
                                screenings[registration.id].band
                              : "Not scored"}
                          </Badge>
                          <span className="text-muted-foreground">
                            Score {screenings[registration.id].total_score}
                          </span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setOpenScreening(registration)}>
                          <ClipboardList className="mr-2 h-4 w-4" />
                          View transcript
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No assistant screening was completed with this application.
                      </p>
                    )}
                  </div>

                  {registration.status === "pending" && canReviewApplications && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="bg-success hover:bg-success/90 text-primary-foreground"
                        disabled={processingId === registration.id}
                        onClick={() => handleApprove(registration)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {processingId === registration.id ? "Approving..." : "Approve"}
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

        <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Account activated</DialogTitle>
              <DialogDescription>
                No email is sent yet — this notice is stored in the notification outbox. Share these
                details with the caregiver directly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Email: </span>
                <span className="text-muted-foreground">{credentials?.email}</span>
              </div>
              <div>
                <span className="font-medium">Password: </span>
                <span className="text-muted-foreground">
                  {credentials?.password ?? "the password chosen during registration"}
                </span>
              </div>
            </div>
            <DialogFooter>
              {credentials?.password && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (credentials.password) {
                      navigator.clipboard.writeText(credentials.password);
                    }
                  }}
                >
                  Copy password
                </Button>
              )}
              <Button onClick={() => setCredentials(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CaregiverApprovals;
