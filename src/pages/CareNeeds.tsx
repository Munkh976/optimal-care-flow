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

const CareNeeds = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCareNeed, setSelectedCareNeed] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewCareNeed, setViewCareNeed] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "",
    description: "",
    related_care_type_codes: [] as string[],
  });

  const { data: careNeeds, isLoading } = useQuery({
    queryKey: ["care-needs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_needs")
        .select("*")
        .order("code");
      
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (careNeed: any) => {
    setSelectedCareNeed(careNeed);
    setFormData({
      code: careNeed.code,
      name: careNeed.name,
      category: careNeed.category || "",
      description: careNeed.description || "",
      related_care_type_codes: careNeed.related_care_type_codes || [],
    });
    setIsDialogOpen(true);
  };

  const handleView = (careNeed: any) => {
    setViewCareNeed(careNeed);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("care_needs")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast.success("Care need deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["care-needs"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete care need");
    } finally {
      setDeleteId(null);
    }
  };

  const handleSave = async () => {
    try {
      if (selectedCareNeed) {
        const { error } = await supabase
          .from("care_needs")
          .update({
            name: formData.name,
            category: formData.category,
            description: formData.description,
            related_care_type_codes: formData.related_care_type_codes,
          })
          .eq("id", selectedCareNeed.id);

        if (error) throw error;
        toast.success("Care need updated successfully");
      } else {
        const { error } = await supabase
          .from("care_needs")
          .insert({
            code: formData.code,
            name: formData.name,
            category: formData.category,
            description: formData.description,
            related_care_type_codes: formData.related_care_type_codes,
          });

        if (error) throw error;
        toast.success("Care need created successfully");
      }
      
      queryClient.invalidateQueries({ queryKey: ["care-needs"] });
      setIsDialogOpen(false);
      setSelectedCareNeed(null);
      setFormData({ code: "", name: "", category: "", description: "", related_care_type_codes: [] });
    } catch (error: any) {
      toast.error(error.message || "Failed to save care need");
    }
  };

  const filteredCareNeeds = careNeeds?.filter(careNeed => {
    const matchesSearch = searchQuery === "" ||
      careNeed.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      careNeed.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      careNeed.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = filterCategory === "all" || careNeed.category === filterCategory;

    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && careNeed.is_active) ||
      (filterStatus === "inactive" && !careNeed.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (isLoading) {
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">Care Needs</h2>
          <p className="text-muted-foreground">Manage client care requirements (NHATS)</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setSelectedCareNeed(null);
            setFormData({ code: "", name: "", category: "", description: "", related_care_type_codes: [] });
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Care Need
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
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="ADL">ADL</SelectItem>
              <SelectItem value="IADL">IADL</SelectItem>
              <SelectItem value="Mobility">Mobility</SelectItem>
              <SelectItem value="Cognitive">Cognitive</SelectItem>
              <SelectItem value="Emotional">Emotional</SelectItem>
              <SelectItem value="Social">Social</SelectItem>
              <SelectItem value="Health">Health</SelectItem>
              <SelectItem value="Household">Household</SelectItem>
              <SelectItem value="Transport">Transport</SelectItem>
              <SelectItem value="Specialized">Specialized</SelectItem>
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
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Related Care Types</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCareNeeds?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No care needs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCareNeeds?.map((careNeed) => (
                  <TableRow key={careNeed.id}>
                    <TableCell className="font-medium">{careNeed.code}</TableCell>
                    <TableCell>{careNeed.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{careNeed.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{careNeed.description || "-"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap gap-1">
                        {careNeed.related_care_type_codes?.map((code: string) => (
                          <Badge key={code} variant="secondary" className="text-xs">
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={careNeed.is_active ? "default" : "secondary"}>
                        {careNeed.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(careNeed)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(careNeed)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(careNeed.id)}
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
            <DialogTitle>{selectedCareNeed ? "Edit Care Need" : "Add New Care Need"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., CN001"
                  disabled={!!selectedCareNeed}
                />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter care need name"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADL">ADL - Activities of Daily Living</SelectItem>
                    <SelectItem value="IADL">IADL - Instrumental Activities</SelectItem>
                    <SelectItem value="Mobility">Mobility</SelectItem>
                    <SelectItem value="Cognitive">Cognitive</SelectItem>
                    <SelectItem value="Emotional">Emotional</SelectItem>
                    <SelectItem value="Social">Social</SelectItem>
                    <SelectItem value="Health">Health</SelectItem>
                    <SelectItem value="Household">Household</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Specialized">Specialized</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Related Care Type Codes</Label>
                <Input
                  value={formData.related_care_type_codes.join(", ")}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    related_care_type_codes: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="e.g., CT001, CT002"
                />
                <p className="text-sm text-muted-foreground mt-1">Comma-separated care type codes</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {selectedCareNeed ? "Update" : "Add"}
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
                <Label className="text-muted-foreground">Code</Label>
                <p className="text-lg font-medium">{viewCareNeed.code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-lg font-medium">{viewCareNeed.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <div className="mt-1">
                  <Badge variant="outline">{viewCareNeed.category}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{viewCareNeed.description || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Related Care Type Codes</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {viewCareNeed.related_care_type_codes?.map((code: string) => (
                    <Badge key={code} variant="secondary">
                      {code}
                    </Badge>
                  ))}
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
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Care Need</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this care need? This action cannot be undone.
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

export default CareNeeds;
