import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AppRole = "system_admin" | "agency_admin" | "manager" | "scheduler" | "hr_staff" | "caregiver" | "client";

interface SystemModule {
  id: string;
  module_code: string;
  module_name: string;
  description: string | null;
  category: string;
  is_active: boolean;
}

interface RolePermission {
  id: string;
  role_code: AppRole;
  module_code: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface SystemRole {
  id: string;
  role_name: string;
  role_code: AppRole;
  is_active: boolean;
}

const RolePermissions = () => {
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase.rpc("get_user_role", {
        _user_id: user.id,
      });

      if (!roleData || roleData !== "system_admin") {
        toast.error("Access denied. Only system administrators can manage role permissions");
        navigate("/");
        return;
      }

      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [modulesRes, rolesRes, permissionsRes] = await Promise.all([
        supabase.from("system_modules").select("*").order("category", { ascending: true }).order("module_name", { ascending: true }),
        supabase.from("system_roles").select("*").eq("is_active", true).order("access_level", { ascending: false }),
        supabase.from("role_permissions").select("*"),
      ]);

      if (modulesRes.error) throw modulesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (permissionsRes.error) throw permissionsRes.error;

      setModules(modulesRes.data || []);
      setRoles(rolesRes.data || []);
      setPermissions(permissionsRes.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load permissions data");
    }
  };

  const getPermission = (roleCode: AppRole, moduleCode: string): RolePermission | undefined => {
    return permissions.find(p => p.role_code === roleCode && p.module_code === moduleCode);
  };

  const updatePermission = (roleCode: AppRole, moduleCode: string, field: keyof Pick<RolePermission, 'can_create' | 'can_read' | 'can_update' | 'can_delete'>, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.role_code === roleCode && p.module_code === moduleCode);
      
      if (existing) {
        return prev.map(p => 
          p.role_code === roleCode && p.module_code === moduleCode
            ? { ...p, [field]: value }
            : p
        );
      } else {
        // Create new permission entry
        const newPermission: RolePermission = {
          id: crypto.randomUUID(),
          role_code: roleCode,
          module_code: moduleCode,
          can_create: field === 'can_create' ? value : false,
          can_read: field === 'can_read' ? value : false,
          can_update: field === 'can_update' ? value : false,
          can_delete: field === 'can_delete' ? value : false,
        };
        return [...prev, newPermission];
      }
    });
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      // Delete all existing permissions and recreate them
      const { error: deleteError } = await supabase
        .from("role_permissions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (deleteError) throw deleteError;

      // Insert all permissions
      const permissionsToInsert = permissions.map(({ id, ...rest }) => rest);
      
      const { error: insertError } = await supabase
        .from("role_permissions")
        .insert(permissionsToInsert);

      if (insertError) throw insertError;

      toast.success("Role permissions updated successfully");

      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const categories = ["all", ...Array.from(new Set(modules.map(m => m.category)))];
  const filteredModules = selectedCategory === "all" 
    ? modules 
    : modules.filter(m => m.category === selectedCategory);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Role Permissions Management</CardTitle>
                <CardDescription>
                  Configure CRUD (Create, Read, Update, Delete) permissions for each role on system modules
                </CardDescription>
              </div>
              <Button onClick={handleSavePermissions} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save All Changes
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="mb-4">
                {categories.map(category => (
                  <TabsTrigger key={category} value={category}>
                    {category === "all" ? "All Modules" : category.charAt(0).toUpperCase() + category.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={selectedCategory}>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px] sticky left-0 bg-background z-10">Module</TableHead>
                        {roles.map(role => (
                          <TableHead key={role.id} className="text-center min-w-[160px]">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline">{role.role_name}</Badge>
                              <div className="text-xs text-muted-foreground flex gap-2">
                                <span>C</span>
                                <span>R</span>
                                <span>U</span>
                                <span>D</span>
                              </div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredModules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={roles.length + 1} className="text-center text-muted-foreground">
                            No modules found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredModules.map(module => (
                          <TableRow key={module.id}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10">
                              <div>
                                <div className="font-semibold">{module.module_name}</div>
                                <div className="text-xs text-muted-foreground">{module.module_code}</div>
                              </div>
                            </TableCell>
                            {roles.map(role => {
                              const permission = getPermission(role.role_code, module.module_code);
                              return (
                                <TableCell key={role.id} className="text-center">
                                  <div className="flex justify-center gap-4">
                                    <Checkbox
                                      checked={permission?.can_create || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.role_code, module.module_code, 'can_create', checked as boolean)
                                      }
                                      title="Create"
                                    />
                                    <Checkbox
                                      checked={permission?.can_read || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.role_code, module.module_code, 'can_read', checked as boolean)
                                      }
                                      title="Read"
                                    />
                                    <Checkbox
                                      checked={permission?.can_update || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.role_code, module.module_code, 'can_update', checked as boolean)
                                      }
                                      title="Update"
                                    />
                                    <Checkbox
                                      checked={permission?.can_delete || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.role_code, module.module_code, 'can_delete', checked as boolean)
                                      }
                                      title="Delete"
                                    />
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RolePermissions;
