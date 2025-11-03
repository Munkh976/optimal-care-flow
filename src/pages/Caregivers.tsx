import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Mail, Phone, MapPin, Award, Search, Upload, Eye, Trash2, Edit, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ReactSelect from "react-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Caregivers = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteCaregiver, setDeleteCaregiver] = useState<any>(null);
  const [editCaregiver, setEditCaregiver] = useState<any>(null);
  const [viewCaregiver, setViewCaregiver] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [newSkill, setNewSkill] = useState({
    care_type_code: "",
    proficiency_level: "intermediate",
    years_experience: 0,
    is_certified: false,
  });
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hourly_rate: "",
    employment_type: "full_time",
    city: "",
    state: "",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        fetchCaregivers(session.user.id);
        fetchCareTypes();
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchCaregivers = async (userId: string) => {
    const { data, error } = await supabase
      .from("caregivers")
      .select(`
        *,
        caregiver_skills(
          id,
          care_type_code,
          proficiency_level,
          years_experience,
          is_certified,
          care_types(code, name, category)
        )
      `)
      .eq("agency_id", userId)
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching caregivers:", error);
      toast.error("Failed to load caregivers");
    } else {
      setCaregivers(data || []);
    }
    setLoading(false);
  };

  const fetchCareTypes = async () => {
    const { data, error } = await supabase
      .from("care_types")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching care types:", error);
    } else {
      setCareTypes(data || []);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleOpenAddDialog = () => {
    setIsEditMode(false);
    setEditCaregiver(null);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      hourly_rate: "",
      employment_type: "full_time",
      city: "",
      state: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (caregiver: any) => {
    setIsEditMode(true);
    setEditCaregiver(caregiver);
    setFormData({
      first_name: caregiver.first_name || "",
      last_name: caregiver.last_name || "",
      email: caregiver.email || "",
      phone: caregiver.phone || "",
      hourly_rate: caregiver.hourly_rate?.toString() || "",
      employment_type: caregiver.employment_type || "full_time",
      city: caregiver.city || "",
      state: caregiver.state || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSaveCaregiver = async () => {
    if (!user || !formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    const caregiverData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      employment_type: formData.employment_type,
      city: formData.city,
      state: formData.state,
    };

    if (isEditMode && editCaregiver) {
      const { error } = await supabase
        .from("caregivers")
        .update(caregiverData)
        .eq("id", editCaregiver.id);

      if (error) {
        toast.error("Failed to update caregiver");
      } else {
        toast.success("Caregiver updated successfully");
        setIsAddDialogOpen(false);
        if (user) fetchCaregivers(user.id);
      }
    } else {
      const { error } = await supabase.from("caregivers").insert({
        ...caregiverData,
        agency_id: user.id,
      });

      if (error) {
        toast.error("Failed to add caregiver");
      } else {
        toast.success("Caregiver added successfully");
        setIsAddDialogOpen(false);
        if (user) fetchCaregivers(user.id);
      }
    }
  };

  const handleDeleteCaregiver = async () => {
    if (!deleteCaregiver) return;

    const { error } = await supabase
      .from("caregivers")
      .delete()
      .eq("id", deleteCaregiver.id);

    if (error) {
      console.error("Error deleting caregiver:", error);
      toast.error("Failed to delete caregiver");
    } else {
      toast.success("Caregiver deleted successfully");
      setDeleteCaregiver(null);
      if (user) fetchCaregivers(user.id);
    }
  };

  const handleAddSkill = async () => {
    if (!viewCaregiver || !newSkill.care_type_code) {
      toast.error("Please select a care type");
      return;
    }

    const { error } = await supabase
      .from("caregiver_skills")
      .insert({
        caregiver_id: viewCaregiver.id,
        care_type_code: newSkill.care_type_code,
        proficiency_level: newSkill.proficiency_level,
        years_experience: newSkill.years_experience,
        is_certified: newSkill.is_certified,
      });

    if (error) {
      console.error("Error adding skill:", error);
      toast.error("Failed to add skill");
    } else {
      toast.success("Skill added successfully");
      setNewSkill({
        care_type_code: "",
        proficiency_level: "intermediate",
        years_experience: 0,
        is_certified: false,
      });
      if (user) {
        await fetchCaregivers(user.id);
        // Update viewCaregiver with fresh data
        const updatedCaregiver = caregivers.find(c => c.id === viewCaregiver.id);
        if (updatedCaregiver) setViewCaregiver(updatedCaregiver);
      }
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    const { error } = await supabase
      .from("caregiver_skills")
      .delete()
      .eq("id", skillId);

    if (error) {
      console.error("Error deleting skill:", error);
      toast.error("Failed to delete skill");
    } else {
      toast.success("Skill removed successfully");
      if (user) {
        await fetchCaregivers(user.id);
        // Update viewCaregiver with fresh data
        const updatedCaregiver = caregivers.find(c => c.id === viewCaregiver.id);
        if (updatedCaregiver) setViewCaregiver(updatedCaregiver);
      }
    }
  };

  const handleBulkImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const caregiver: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index];
          if (header === 'hourly_rate') {
            caregiver[header] = parseFloat(value) || 0;
          } else if (header === 'is_active') {
            caregiver[header] = value.toLowerCase() === 'true';
          } else {
            caregiver[header] = value;
          }
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) continue;

        const { error } = await supabase
          .from('caregivers')
          .insert({
            ...caregiver,
            agency_id: user.id
          });

        if (error) {
          console.error('Error importing caregiver:', error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      toast.success(`Imported ${successCount} caregivers${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      if (user) fetchCaregivers(user.id);
    };
    input.click();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "full_time": return "bg-primary/10 text-primary border-primary/20";
      case "part_time": return "bg-accent/10 text-accent border-accent/20";
      case "on_call": return "bg-secondary/10 text-secondary border-secondary/20";
      default: return "bg-muted";
    }
  };

  // Filter caregivers
  const filteredCaregivers = caregivers.filter(caregiver => {
    const fullName = `${caregiver.first_name} ${caregiver.last_name}`.toLowerCase();
    const matchesSearch = searchQuery === "" ||
      fullName.includes(searchQuery.toLowerCase()) ||
      caregiver.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caregiver.skills?.some((skill: string) => skill.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filterRole === "all" || caregiver.employment_type === filterRole;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && caregiver.is_active) ||
      (filterStatus === "inactive" && !caregiver.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading caregivers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">CareMuch</h1>
              <p className="text-sm text-muted-foreground">{profile?.agency_name || "Care Agency"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name || user?.email}
            </span>
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">Caregiver Management</h2>
            <p className="text-muted-foreground">Manage your caregiver roster</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleBulkImport}>
              <Upload className="h-4 w-4" />
              Upload/Import Table
            </Button>
            <Button className="gap-2" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4" />
              Add Caregiver
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Edit Caregiver" : "Add New Caregiver"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hourly_rate">Hourly Rate</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        step="0.01"
                        value={formData.hourly_rate}
                        onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employment_type">Employment Type</Label>
                      <Select
                        value={formData.employment_type}
                        onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
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
                  </div>
                  <div className="bg-muted p-3 rounded text-sm text-muted-foreground">
                    Note: Caregiver skills can be managed through Care Types assignments after saving.
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCaregiver}>
                    {isEditMode ? "Update" : "Add"} Caregiver
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Employment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="on_call">On Call</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Caregivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredCaregivers.length}</div>
              <div className="text-xs text-muted-foreground">of {caregivers.length} total</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {caregivers.filter(c => c.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                ${(caregivers.reduce((sum, c) => sum + (c.hourly_rate || 0), 0) / caregivers.length || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Caregivers Table */}
        <Card>
          <CardContent className="p-6">
            {filteredCaregivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  {caregivers.length === 0 ? "No caregivers in your roster yet" : "No caregivers match your filters"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                      <TableHead>Care Types</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCaregivers.map((caregiver) => (
                    <TableRow key={caregiver.id}>
                      <TableCell className="font-medium">
                        {caregiver.first_name} {caregiver.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {caregiver.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {caregiver.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getRoleColor(caregiver.employment_type)}>
                          {caregiver.employment_type?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary">${caregiver.hourly_rate}</span>
                        <span className="text-xs text-muted-foreground">/hr</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={caregiver.is_active ? "default" : "secondary"}>
                          {caregiver.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {caregiver.caregiver_skills && caregiver.caregiver_skills.length > 0 ? (
                            caregiver.caregiver_skills.slice(0, 2).map((skill: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {skill.care_types?.name || skill.care_type_code}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                          {caregiver.caregiver_skills && caregiver.caregiver_skills.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{caregiver.caregiver_skills.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewCaregiver(caregiver)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDialog(caregiver)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteCaregiver(caregiver)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* View Details Dialog */}
      <Dialog open={!!viewCaregiver} onOpenChange={() => setViewCaregiver(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Caregiver Details</DialogTitle>
          </DialogHeader>
          {viewCaregiver && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Information</TabsTrigger>
                <TabsTrigger value="skills">Skills & Care Types</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">
                      {viewCaregiver.first_name} {viewCaregiver.last_name}
                    </h3>
                    <Badge variant="outline" className={getRoleColor(viewCaregiver.employment_type)}>
                      {viewCaregiver.employment_type?.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">${viewCaregiver.hourly_rate}</div>
                    <div className="text-xs text-muted-foreground">per hour</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{viewCaregiver.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{viewCaregiver.phone}</span>
                  </div>
                  {viewCaregiver.city && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{viewCaregiver.city}, {viewCaregiver.state}</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="skills" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Current Skills & Care Types</span>
                  </div>
                  
                  {viewCaregiver.caregiver_skills && viewCaregiver.caregiver_skills.length > 0 ? (
                    <div className="space-y-2">
                      {viewCaregiver.caregiver_skills.map((skill: any) => (
                        <div key={skill.id} className="flex items-start justify-between p-3 rounded border bg-card">
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">
                              {skill.care_types?.name || skill.care_type_code}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {skill.care_types?.category && (
                                <Badge variant="outline" className="text-xs">
                                  {skill.care_types.category}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs capitalize">
                                {skill.proficiency_level}
                              </Badge>
                              {skill.years_experience > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {skill.years_experience} years
                                </Badge>
                              )}
                              {skill.is_certified && (
                                <Badge variant="default" className="text-xs">
                                  Certified
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSkill(skill.id)}
                            className="ml-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No skills added yet
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Add New Skill</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Care Type *</Label>
                        <Select
                          value={newSkill.care_type_code}
                          onValueChange={(value) => setNewSkill({ ...newSkill, care_type_code: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select care type" />
                          </SelectTrigger>
                          <SelectContent>
                            {careTypes.map((type) => (
                              <SelectItem key={type.code} value={type.code}>
                                {type.name} ({type.category})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Proficiency Level</Label>
                          <Select
                            value={newSkill.proficiency_level}
                            onValueChange={(value) => setNewSkill({ ...newSkill, proficiency_level: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner</SelectItem>
                              <SelectItem value="intermediate">Intermediate</SelectItem>
                              <SelectItem value="advanced">Advanced</SelectItem>
                              <SelectItem value="expert">Expert</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Years of Experience</Label>
                          <Input
                            type="number"
                            min="0"
                            value={newSkill.years_experience}
                            onChange={(e) => setNewSkill({ ...newSkill, years_experience: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_certified"
                          checked={newSkill.is_certified}
                          onChange={(e) => setNewSkill({ ...newSkill, is_certified: e.target.checked })}
                          className="rounded border-input"
                        />
                        <Label htmlFor="is_certified" className="cursor-pointer">
                          Certified in this care type
                        </Label>
                      </div>

                      <Button onClick={handleAddSkill} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Skill
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCaregiver} onOpenChange={() => setDeleteCaregiver(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Caregiver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteCaregiver?.first_name} {deleteCaregiver?.last_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCaregiver} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Caregivers;
