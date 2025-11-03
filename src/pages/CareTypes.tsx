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

const CareTypes = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteCareType, setDeleteCareType] = useState<any>(null);
  const [editCareType, setEditCareType] = useState<any>(null);
  const [viewCareType, setViewCareType] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
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
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching care types:", error);
      toast.error("Failed to load care types");
    } else {
      setCareTypes(data || []);
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
    setEditCareType(null);
    setFormData({
      name: "",
      description: "",
      color: "#3b82f6",
      is_active: true,
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (careType: any) => {
    setIsEditMode(true);
    setEditCareType(careType);
    setFormData({
      name: careType.name || "",
      description: careType.description || "",
      color: careType.color || "#3b82f6",
      is_active: careType.is_active ?? true,
    });
    setIsAddDialogOpen(true);
  };

  const handleSaveCareType = async () => {
    if (!user || !formData.name) {
      toast.error("Please fill in all required fields");
      return;
    }

    const careTypeData = {
      name: formData.name,
      description: formData.description,
      color: formData.color,
      is_active: formData.is_active,
    };

    if (isEditMode && editCareType) {
      const { error } = await supabase
        .from("care_types")
        .update(careTypeData)
        .eq("id", editCareType.id);

      if (error) {
        toast.error("Failed to update care type");
      } else {
        toast.success("Care type updated successfully");
        setIsAddDialogOpen(false);
        if (user) fetchCareTypes(user.id);
      }
    } else {
      const { error } = await supabase.from("care_types").insert({
        ...careTypeData,
        agency_id: user.id,
      });

      if (error) {
        toast.error("Failed to add care type");
      } else {
        toast.success("Care type added successfully");
        setIsAddDialogOpen(false);
        if (user) fetchCareTypes(user.id);
      }
    }
  };

  const handleDeleteCareType = async () => {
    if (!deleteCareType) return;

    const { error } = await supabase
      .from("care_types")
      .delete()
      .eq("id", deleteCareType.id);

    if (error) {
      console.error("Error deleting care type:", error);
      toast.error("Failed to delete care type");
    } else {
      toast.success("Care type deleted successfully");
      setDeleteCareType(null);
      if (user) fetchCareTypes(user.id);
    }
  };

  const filteredCareTypes = careTypes.filter(careType => {
    const matchesSearch = searchQuery === "" ||
      careType.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      careType.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && careType.is_active) ||
      (filterStatus === "inactive" && !careType.is_active);

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading care types...</p>
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
            <h2 className="text-3xl font-bold mb-2">Care Types</h2>
            <p className="text-muted-foreground">Manage care service types</p>
          </div>
          <Button className="gap-2" onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4" />
            Add Care Type
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
                  <TableHead>Description</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCareTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No care types found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCareTypes.map((careType) => (
                    <TableRow key={careType.id}>
                      <TableCell className="font-medium">{careType.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{careType.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border" 
                            style={{ backgroundColor: careType.color }}
                          />
                          <span className="text-xs text-muted-foreground">{careType.color}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={careType.is_active ? "default" : "secondary"}>
                          {careType.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewCareType(careType)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(careType)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteCareType(careType)}
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
            <DialogTitle>{isEditMode ? "Edit Care Type" : "Add New Care Type"}</DialogTitle>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1"
                />
              </div>
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
            <Button onClick={handleSaveCareType}>
              {isEditMode ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewCareType} onOpenChange={() => setViewCareType(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Care Type Details</DialogTitle>
          </DialogHeader>
          {viewCareType && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-lg font-medium">{viewCareType.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{viewCareType.description || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div 
                    className="w-8 h-8 rounded border" 
                    style={{ backgroundColor: viewCareType.color }}
                  />
                  <span>{viewCareType.color}</span>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge variant={viewCareType.is_active ? "default" : "secondary"}>
                    {viewCareType.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCareType} onOpenChange={() => setDeleteCareType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Care Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCareType?.name}"? This action cannot be undone and will also delete all associated care needs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCareType}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CareTypes;
