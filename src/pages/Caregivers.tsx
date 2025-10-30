import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Mail, Phone, MapPin, Award, Search, Upload, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [viewCaregiver, setViewCaregiver] = useState<any>(null);
  const [newCaregiver, setNewCaregiver] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hourly_rate: "",
    employment_type: "full_time",
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
      .select("*")
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleAddCaregiver = async () => {
    if (!user || !newCaregiver.first_name || !newCaregiver.last_name || !newCaregiver.email || !newCaregiver.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    const { error } = await supabase.from("caregivers").insert({
      agency_id: user.id,
      first_name: newCaregiver.first_name,
      last_name: newCaregiver.last_name,
      email: newCaregiver.email,
      phone: newCaregiver.phone,
      hourly_rate: newCaregiver.hourly_rate ? parseFloat(newCaregiver.hourly_rate) : null,
      employment_type: newCaregiver.employment_type,
    });

    if (error) {
      console.error("Error adding caregiver:", error);
      toast.error("Failed to add caregiver");
    } else {
      toast.success("Caregiver added successfully");
      setIsAddDialogOpen(false);
      setNewCaregiver({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        hourly_rate: "",
        employment_type: "full_time",
      });
      if (user) fetchCaregivers(user.id);
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

  const handleBulkImport = () => {
    toast.info("Bulk import feature coming soon! Please use CSV import.");
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
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Caregiver
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Caregiver</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={newCaregiver.first_name}
                        onChange={(e) => setNewCaregiver({ ...newCaregiver, first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={newCaregiver.last_name}
                        onChange={(e) => setNewCaregiver({ ...newCaregiver, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCaregiver.email}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newCaregiver.phone}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hourly_rate">Hourly Rate</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        step="0.01"
                        value={newCaregiver.hourly_rate}
                        onChange={(e) => setNewCaregiver({ ...newCaregiver, hourly_rate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employment_type">Employment Type</Label>
                      <Select
                        value={newCaregiver.employment_type}
                        onValueChange={(value) => setNewCaregiver({ ...newCaregiver, employment_type: value })}
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCaregiver}>Add Caregiver</Button>
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
              placeholder="Search by name, email, or skills..."
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
                    <TableHead>Skills</TableHead>
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
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {caregiver.skills && caregiver.skills.length > 0 ? (
                            caregiver.skills.slice(0, 2).map((skill: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No skills</span>
                          )}
                          {caregiver.skills && caregiver.skills.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{caregiver.skills.length - 2}
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Caregiver Details</DialogTitle>
          </DialogHeader>
          {viewCaregiver && (
            <div className="space-y-6">
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

              {viewCaregiver.certifications && viewCaregiver.certifications.length > 0 && (
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Certifications</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewCaregiver.certifications.map((cert: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewCaregiver.skills && viewCaregiver.skills.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {viewCaregiver.skills.map((skill: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
