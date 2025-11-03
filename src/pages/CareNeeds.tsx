import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, LogOut, Plus, Search, Eye, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const CareNeeds = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [careNeeds, setCareNeeds] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCareType, setFilterCareType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteCareNeed, setDeleteCareNeed] = useState<any>(null);
  const [editCareNeed, setEditCareNeed] = useState<any>(null);
  const [viewCareNeed, setViewCareNeed] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    care_type_id: "",
    requires_certification: false,
    is_active: true,
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
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        fetchCareTypes(session.user.id);
        fetchCareNeeds(session.user.id);
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

  const fetchCareTypes = async (userId: string) => {
    const { data, error } = await supabase
      .from("care_types")
      .select("*")
      .eq("agency_id", userId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching care types:", error);
    } else {
      setCareTypes(data || []);
    }
  };

  const fetchCareNeeds = async (userId: string) => {
    const { data, error } = await supabase
      .from("care_needs")
      .select(`
        *,
        care_types (
          id,
          name,
          color
        )
      `)
      .eq("agency_id", userId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching care needs:", error);
      toast.error("Failed to load care needs");
    } else {
      setCareNeeds(data || []);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleOpenAddDialog = () => {
    setIsEditMode(false);
    setEditCareNeed(null);
    setFormData({
      name: "",
      description: "",
      care_type_id: "",
      requires_certification: false,
      is_active: true,
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (careNeed: any) => {
    setIsEditMode(true);
    setEditCareNeed(careNeed);
    setFormData({
      name: careNeed.name || "",
      description: careNeed.description || "",
      care_type_id: careNeed.care_type_id || "",
      requires_certification: careNeed.requires_certification ?? false,
      is_active: careNeed.is_active ?? true,
    });
    setIsAddDialogOpen(true);
  };

  const handleSaveCareNeed = async () => {
    if (!user || !formData.name || !formData.care_type_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    const careNeedData = {
      name: formData.name,
      description: formData.description,
      care_type_id: formData.care_type_id,
      requires_certification: formData.requires_certification,
      is_active: formData.is_active,
    };

    if (isEditMode && editCareNeed) {
      const { error } = await supabase
        .from("care_needs")
        .update(careNeedData)
        .eq("id", editCareNeed.id);

      if (error) {
        toast.error("Failed to update care need");
      } else {
        toast.success("Care need updated successfully");
        setIsAddDialogOpen(false);
        if (user) fetchCareNeeds(user.id);
      }
    } else {
      const { error } = await supabase.from("care_needs").insert({
        ...careNeedData,
        agency_id: user.id,
      });

      if (error) {
        toast.error("Failed to add care need");
      } else {
        toast.success("Care need added successfully");
        setIsAddDialogOpen(false);
        if (user) fetchCareNeeds(user.id);
      }
    }
  };

  const handleDeleteCareNeed = async () => {
    if (!deleteCareNeed) return;

    const { error } = await supabase
      .from("care_needs")
      .delete()
      .eq("id", deleteCareNeed.id);

    if (error) {
      console.error("Error deleting care need:", error);
      toast.error("Failed to delete care need");
    } else {
      toast.success("Care need deleted successfully");
      setDeleteCareNeed(null);
      if (user) fetchCareNeeds(user.id);
    }
  };

  const filteredCareNeeds = careNeeds.filter(careNeed => {
    const matchesSearch = searchQuery === "" ||
      careNeed.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      careNeed.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCareType = filterCareType === "all" || careNeed.care_type_id === filterCareType;

    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && careNeed.is_active) ||
      (filterStatus === "inactive" && !careNeed.is_active);

    return matchesSearch && matchesCareType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading care needs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">Care Needs</h2>
            <p className="text-muted-foreground">Manage specific care requirements</p>
          </div>
          <Button className="gap-2" onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4" />
            Add Care Need
          </Button>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCareType} onValueChange={setFilterCareType}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Care Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Care Types</SelectItem>
                {careTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Care Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Certification Required</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCareNeeds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No care needs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCareNeeds.map((careNeed) => (
                    <TableRow key={careNeed.id}>
                      <TableCell className="font-medium">{careNeed.name}</TableCell>
                      <TableCell>
                        <Badge 
                          style={{ 
                            backgroundColor: careNeed.care_types?.color || "#3b82f6",
                            color: "white"
                          }}
                        >
                          {careNeed.care_types?.name || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{careNeed.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={careNeed.requires_certification ? "default" : "secondary"}>
                          {careNeed.requires_certification ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={careNeed.is_active ? "default" : "secondary"}>
                          {careNeed.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewCareNeed(careNeed)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(careNeed)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteCareNeed(careNeed)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Care Need" : "Add New Care Need"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="care_type_id">Care Type *</Label>
              <Select
                value={formData.care_type_id}
                onValueChange={(value) => setFormData({ ...formData, care_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select care type" />
                </SelectTrigger>
                <SelectContent>
                  {careTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requires_certification"
                checked={formData.requires_certification}
                onChange={(e) => setFormData({ ...formData, requires_certification: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="requires_certification">Requires Certification</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCareNeed}>
              {isEditMode ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewCareNeed} onOpenChange={() => setViewCareNeed(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Care Need Details</DialogTitle>
          </DialogHeader>
          {viewCareNeed && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-lg font-medium">{viewCareNeed.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Care Type</Label>
                <div className="mt-1">
                  <Badge 
                    style={{ 
                      backgroundColor: viewCareNeed.care_types?.color || "#3b82f6",
                      color: "white"
                    }}
                  >
                    {viewCareNeed.care_types?.name || "Unknown"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{viewCareNeed.description || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Certification Required</Label>
                <div className="mt-1">
                  <Badge variant={viewCareNeed.requires_certification ? "default" : "secondary"}>
                    {viewCareNeed.requires_certification ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge variant={viewCareNeed.is_active ? "default" : "secondary"}>
                    {viewCareNeed.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCareNeed} onOpenChange={() => setDeleteCareNeed(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Care Need</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCareNeed?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCareNeed}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CareNeeds;
