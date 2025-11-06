import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { User, Phone, Mail, MapPin, Heart, Bell, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface CareNeed {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
}

interface ClientCareNeed {
  id: string;
  care_need_code: string;
  priority: number;
  notes: string | null;
  care_need?: CareNeed;
}

export const ProfileSettings = ({ clientProfile, userEmail, onRefresh }: ProfileSettingsProps) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(clientProfile);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [clientCareNeeds, setClientCareNeeds] = useState<ClientCareNeed[]>([]);
  const [availableCareNeeds, setAvailableCareNeeds] = useState<CareNeed[]>([]);
  const [selectedCareNeed, setSelectedCareNeed] = useState<string>("");

  useEffect(() => {
    if (clientProfile?.id) {
      fetchClientCareNeeds();
      fetchAvailableCareNeeds();
    }
  }, [clientProfile?.id]);

  const fetchClientCareNeeds = async () => {
    if (!clientProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from("client_care_needs")
        .select(`
          id,
          care_need_code,
          priority,
          notes,
          care_needs:care_need_code (
            id,
            code,
            name,
            category,
            description
          )
        `)
        .eq("client_id", clientProfile.id)
        .order("priority", { ascending: true });

      if (error) throw error;
      
      const formattedData = data.map(item => ({
        ...item,
        care_need: Array.isArray(item.care_needs) ? item.care_needs[0] : item.care_needs
      }));
      
      setClientCareNeeds(formattedData as any);
    } catch (error: any) {
      console.error("Error fetching client care needs:", error);
    }
  };

  const fetchAvailableCareNeeds = async () => {
    try {
      const { data, error } = await supabase
        .from("care_needs")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true });

      if (error) throw error;
      setAvailableCareNeeds(data || []);
    } catch (error: any) {
      console.error("Error fetching care needs:", error);
    }
  };

  const handleAddCareNeed = async () => {
    if (!selectedCareNeed || !clientProfile?.id) return;

    // Check if already exists
    const exists = clientCareNeeds.some(cn => cn.care_need_code === selectedCareNeed);
    if (exists) {
      toast.error("This care need is already added");
      return;
    }

    try {
      const { error } = await supabase
        .from("client_care_needs")
        .insert({
          client_id: clientProfile.id,
          care_need_code: selectedCareNeed,
          priority: clientCareNeeds.length + 1,
        });

      if (error) throw error;

      toast.success("Care need added successfully");
      setSelectedCareNeed("");
      fetchClientCareNeeds();
    } catch (error: any) {
      toast.error(error.message || "Failed to add care need");
    }
  };

  const handleRemoveCareNeed = async (careNeedId: string) => {
    try {
      const { error } = await supabase
        .from("client_care_needs")
        .delete()
        .eq("id", careNeedId);

      if (error) throw error;

      toast.success("Care need removed successfully");
      fetchClientCareNeeds();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove care need");
    }
  };

  const handleUpdateCareNeedPriority = async (careNeedId: string, newPriority: number) => {
    try {
      const { error } = await supabase
        .from("client_care_needs")
        .update({ priority: newPriority })
        .eq("id", careNeedId);

      if (error) throw error;

      toast.success("Priority updated");
      fetchClientCareNeeds();
    } catch (error: any) {
      toast.error(error.message || "Failed to update priority");
    }
  };

  const handleUpdateCareNeedNotes = async (careNeedId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from("client_care_needs")
        .update({ notes })
        .eq("id", careNeedId);

      if (error) throw error;

      toast.success("Notes updated");
      fetchClientCareNeeds();
    } catch (error: any) {
      toast.error(error.message || "Failed to update notes");
    }
  };

  const handleSave = async () => {
    if (!formData || !clientProfile) return;

    try {
      const { error } = await supabase
        .from("clients")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
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

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordSection(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
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
              <Input
                value={formData.first_name}
                onChange={(e) => updateFormData('first_name', e.target.value)}
                disabled={!editMode}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => updateFormData('last_name', e.target.value)}
                disabled={!editMode}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={userEmail} disabled />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => updateFormData('phone', e.target.value)}
              disabled={!editMode}
            />
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
            <Input
              value={formData.address}
              onChange={(e) => updateFormData('address', e.target.value)}
              disabled={!editMode}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={formData.city}
                onChange={(e) => updateFormData('city', e.target.value)}
                disabled={!editMode}
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={formData.state}
                onChange={(e) => updateFormData('state', e.target.value)}
                disabled={!editMode}
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                value={formData.zip_code}
                onChange={(e) => updateFormData('zip_code', e.target.value)}
                disabled={!editMode}
              />
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

      {/* Care Needs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Care Needs
              </CardTitle>
              <CardDescription>Manage your specific care requirements</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode && (
            <div className="flex gap-2">
              <Select value={selectedCareNeed} onValueChange={setSelectedCareNeed}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a care need to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableCareNeeds.map((need) => (
                    <SelectItem key={need.code} value={need.code}>
                      {need.name} ({need.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddCareNeed}
                disabled={!selectedCareNeed}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {clientCareNeeds.length > 0 ? (
            <div className="space-y-3">
              {clientCareNeeds.map((clientNeed) => (
                <Card key={clientNeed.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{clientNeed.care_need?.name}</h4>
                          <Badge variant="outline">{clientNeed.care_need?.category}</Badge>
                        </div>
                        {clientNeed.care_need?.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {clientNeed.care_need.description}
                          </p>
                        )}
                      </div>
                      {editMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCareNeed(clientNeed.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Priority Level</Label>
                        <Select
                          value={clientNeed.priority.toString()}
                          onValueChange={(value) =>
                            handleUpdateCareNeedPriority(clientNeed.id, parseInt(value))
                          }
                          disabled={!editMode}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">High Priority</SelectItem>
                            <SelectItem value="2">Medium Priority</SelectItem>
                            <SelectItem value="3">Low Priority</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Specific Notes</Label>
                      <Textarea
                        value={clientNeed.notes || ""}
                        onChange={(e) => {
                          const updatedNeeds = clientCareNeeds.map(cn =>
                            cn.id === clientNeed.id ? { ...cn, notes: e.target.value } : cn
                          );
                          setClientCareNeeds(updatedNeeds);
                        }}
                        onBlur={(e) => handleUpdateCareNeedNotes(clientNeed.id, e.target.value)}
                        disabled={!editMode}
                        placeholder="Add specific requirements or notes for this care need"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No care needs added yet. {editMode && "Select from the dropdown above to add."}
            </p>
          )}
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

      {/* Security & Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Security & Password
          </CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPasswordSection ? (
            <Button
              variant="outline"
              onClick={() => setShowPasswordSection(true)}
            >
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password (min. 6 characters)"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handlePasswordChange}>
                  Update Password
                </Button>
              </div>
            </div>
          )}
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
