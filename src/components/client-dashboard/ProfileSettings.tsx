import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { User, Phone, Mail, MapPin, Heart, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_conditions: string[];
  notes: string | null;
}

interface ProfileSettingsProps {
  clientProfile: Client | null;
  userEmail: string;
  onRefresh: () => void;
}

export const ProfileSettings = ({ clientProfile, userEmail, onRefresh }: ProfileSettingsProps) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(clientProfile);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);

  const handleSave = async () => {
    if (!formData || !clientProfile) return;

    try {
      const { error } = await supabase
        .from("clients")
        .update({
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          notes: formData.notes,
        })
        .eq("id", clientProfile.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      setEditMode(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (!clientProfile || !formData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Profile not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Profile & Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your personal information and preferences</p>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Your basic profile details</CardDescription>
            </div>
            {!editMode && (
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={clientProfile.first_name} disabled />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={clientProfile.last_name} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={userEmail} disabled />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={clientProfile.phone} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Street Address</Label>
            <Input value={clientProfile.address} disabled />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={clientProfile.city} disabled />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={clientProfile.state} disabled />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input value={clientProfile.zip_code} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contact Name</Label>
            <Input
              value={formData.emergency_contact_name || ""}
              onChange={(e) => updateFormData('emergency_contact_name', e.target.value)}
              disabled={!editMode}
              placeholder="Enter emergency contact name"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input
              value={formData.emergency_contact_phone || ""}
              onChange={(e) => updateFormData('emergency_contact_phone', e.target.value)}
              disabled={!editMode}
              placeholder="Enter emergency contact phone"
            />
          </div>
        </CardContent>
      </Card>

      {/* Medical Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Medical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Medical Conditions</Label>
            <div className="flex flex-wrap gap-2">
              {clientProfile.medical_conditions?.length > 0 ? (
                clientProfile.medical_conditions.map((condition, idx) => (
                  <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    {condition}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No medical conditions listed</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => updateFormData('notes', e.target.value)}
              disabled={!editMode}
              placeholder="Any additional medical information or special requirements"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage how you receive updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates via text message</p>
            </div>
            <Switch
              checked={smsNotifications}
              onCheckedChange={setSmsNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {editMode && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setEditMode(false);
            setFormData(clientProfile);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
};
