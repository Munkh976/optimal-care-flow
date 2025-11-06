import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityDialog } from "./AvailabilityDialog";

interface Caregiver {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
  location_zip_code: string | null;
  service_radius_miles: number | null;
}

interface CaregiverProfileSettingsProps {
  caregiverProfile: Caregiver | null;
  onRefresh: () => void;
}

export const CaregiverProfileSettings = ({ caregiverProfile, onRefresh }: CaregiverProfileSettingsProps) => {
  const [editMode, setEditMode] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [formData, setFormData] = useState(caregiverProfile);

  const handleSave = async () => {
    if (!formData || !caregiverProfile) return;

    try {
      const { error } = await supabase
        .from("caregivers")
        .update({
          location_address: formData.location_address,
          location_city: formData.location_city,
          location_state: formData.location_state,
          location_zip_code: formData.location_zip_code,
          service_radius_miles: formData.service_radius_miles,
        })
        .eq("id", caregiverProfile.id);

      if (error) throw error;

      toast.success("Location settings updated successfully");
      setEditMode(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (!caregiverProfile || !formData) {
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
        <p className="text-sm text-muted-foreground">Manage your location and availability</p>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your basic profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={caregiverProfile.first_name} disabled />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={caregiverProfile.last_name} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={caregiverProfile.email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={caregiverProfile.phone} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Service Location
              </CardTitle>
              <CardDescription>Set your preferred service area</CardDescription>
            </div>
            {!editMode && (
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Street Address</Label>
            <Input
              value={formData.location_address || ""}
              onChange={(e) => updateFormData('location_address', e.target.value)}
              disabled={!editMode}
              placeholder="Enter your service location address"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={formData.location_city || ""}
                onChange={(e) => updateFormData('location_city', e.target.value)}
                disabled={!editMode}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={formData.location_state || ""}
                onChange={(e) => updateFormData('location_state', e.target.value)}
                disabled={!editMode}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                value={formData.location_zip_code || ""}
                onChange={(e) => updateFormData('location_zip_code', e.target.value)}
                disabled={!editMode}
                placeholder="ZIP"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Service Radius (miles)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={formData.service_radius_miles || 10}
              onChange={(e) => updateFormData('service_radius_miles', parseInt(e.target.value))}
              disabled={!editMode}
            />
            <p className="text-xs text-muted-foreground">
              How far are you willing to travel for shifts?
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Availability Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Availability Schedule
          </CardTitle>
          <CardDescription>Manage your weekly availability</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowAvailabilityDialog(true)}>
            Manage Availability
          </Button>
        </CardContent>
      </Card>

      {editMode && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setEditMode(false);
            setFormData(caregiverProfile);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      )}

      {showAvailabilityDialog && (
        <AvailabilityDialog
          caregiver={caregiverProfile}
          isOpen={showAvailabilityDialog}
          onClose={() => setShowAvailabilityDialog(false)}
        />
      )}
    </div>
  );
};