import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Activity, ArrowLeft, CheckCircle2 } from "lucide-react";
import { caregiverRegistrationSchema, firstError } from "@/lib/validation";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ScoreResult } from "@/lib/flowEngine";

const CaregiverRegistration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [screening, setScreening] = useState<{
    sessionId: string | null;
    score: ScoreResult | null;
    link: (registrationId: string) => Promise<void>;
  } | null>(null);
  const [skippedScreening, setSkippedScreening] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    employmentType: "full_time",
    hourlyRate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const parsed = caregiverRegistrationSchema.safeParse(formData);
      if (!parsed.success) {
        toast.error(firstError(parsed));
        return;
      }

      const values = parsed.data;

      const { data: inserted, error: regError } = await supabase
        .from("caregiver_registrations")
        .insert({
        email: values.email,
        phone: values.phone,
        first_name: values.firstName,
        last_name: values.lastName,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        zip_code: values.zipCode || null,
        employment_type: values.employmentType,
        hourly_rate: values.hourlyRate ? parseFloat(values.hourlyRate) : null,
        status: "pending",
        })
        .select("id")
        .single();

      if (regError) throw regError;

      if (inserted?.id && screening?.sessionId) {
        await screening.link(inserted.id);
      }

      toast.success("Application submitted successfully. You can sign in after a manager approves your application.");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <div className="container mx-auto max-w-3xl py-8">
        <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent">
              <Activity className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Caregiver Registration
          </h1>
          <p className="text-muted-foreground">Join our network of professional caregivers</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Apply to Join CareMuch</CardTitle>
            <CardDescription>
              Submit your caregiver application for manager review. Login access is created only after approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select
                    value={formData.employmentType}
                    onValueChange={(value) => setFormData({ ...formData, employmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="on_call">On Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Desired Hourly Rate ($)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Skills and certifications can be added after your registration is approved.
              </p>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting..." : "Submit Registration"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CaregiverRegistration;
