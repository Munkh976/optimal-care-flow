import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Eye, Trash2, Pencil } from "lucide-react";
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
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCareType, setSelectedCareType] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewCareType, setViewCareType] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    typical_caregiver_role: "",
    care_level: "",
  });

  const { data: careTypes, isLoading } = useQuery({
    queryKey: ["care-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_types")
        .select("*")
        .order("code");
      
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (careType: any) => {
    setSelectedCareType(careType);
    setFormData({
      code: careType.code,
      name: careType.name,
      description: careType.description || "",
      typical_caregiver_role: careType.typical_caregiver_role || "",
      care_level: careType.care_level || "",
    });
    setIsDialogOpen(true);
  };

  const handleView = (careType: any) => {
    setViewCareType(careType);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("care_types")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast.success("Care type deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["care-types"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete care type");
    } finally {
      setDeleteId(null);
    }
  };

  const handleSave = async () => {
    try {
      if (selectedCareType) {
        const { error } = await supabase
          .from("care_types")
          .update({
            name: formData.name,
            description: formData.description,
            typical_caregiver_role: formData.typical_caregiver_role,
            care_level: formData.care_level,
          })
          .eq("id", selectedCareType.id);

        if (error) throw error;
        toast.success("Care type updated successfully");
      } else {
        const { error } = await supabase
          .from("care_types")
          .insert({
            code: formData.code,
            name: formData.name,
            description: formData.description,
            typical_caregiver_role: formData.typical_caregiver_role,
            care_level: formData.care_level,
          });

        if (error) throw error;
        toast.success("Care type created successfully");
      }
      
      queryClient.invalidateQueries({ queryKey: ["care-types"] });
      setIsDialogOpen(false);
      setSelectedCareType(null);
      setFormData({ code: "", name: "", description: "", typical_caregiver_role: "", care_level: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to save care type");
    }
  };

  const filteredCareTypes = careTypes?.filter(careType => {
    const matchesSearch = searchQuery === "" ||
      careType.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      careType.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      careType.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && careType.is_active) ||
      (filterStatus === "inactive" && !careType.is_active);

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">Care Types</h2>
          <p className="text-muted-foreground">Manage standardized care service types (NHATS)</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setSelectedCareType(null);
            setFormData({ code: "", name: "", description: "", typical_caregiver_role: "", care_level: "" });
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Care Type
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code or description..."
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
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Caregiver Role</TableHead>
                <TableHead>Care Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCareTypes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No care types found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCareTypes?.map((careType) => (
                  <TableRow key={careType.id}>
                    <TableCell className="font-medium">{careType.code}</TableCell>
                    <TableCell>{careType.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{careType.description || "-"}</TableCell>
                    <TableCell className="text-sm">{careType.typical_caregiver_role || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{careType.care_level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={careType.is_active ? "default" : "secondary"}>
                        {careType.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(careType)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(careType)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(careType.id)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedCareType ? "Edit Care Type" : "Add New Care Type"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., CT001"
                  disabled={!!selectedCareType}
                />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter care type name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
              <div>
                <Label htmlFor="typical_caregiver_role">Typical Caregiver Role</Label>
                <Input
                  id="typical_caregiver_role"
                  value={formData.typical_caregiver_role}
                  onChange={(e) => setFormData({ ...formData, typical_caregiver_role: e.target.value })}
                  placeholder="e.g., CNA, HHA"
                />
              </div>
              <div>
                <Label htmlFor="care_level">Care Level</Label>
                <select
                  id="care_level"
                  value={formData.care_level}
                  onChange={(e) => setFormData({ ...formData, care_level: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select care level</option>
                  <option value="companionship">Companionship</option>
                  <option value="personal_care">Personal Care</option>
                  <option value="skilled_nursing">Skilled Nursing</option>
                  <option value="hospice">Hospice</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {selectedCareType ? "Update" : "Add"}
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
                <Label className="text-muted-foreground">Code</Label>
                <p className="text-lg font-medium">{viewCareType.code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-lg font-medium">{viewCareType.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{viewCareType.description || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Typical Caregiver Role</Label>
                <p>{viewCareType.typical_caregiver_role || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Care Level</Label>
                <div className="mt-1">
                  <Badge variant="outline">{viewCareType.care_level}</Badge>
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
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Care Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this care type? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CareTypes;