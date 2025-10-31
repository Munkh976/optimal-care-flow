import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Loader2, Search, Edit, Key, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  created_at: string;
  role?: string;
  full_name?: string;
}

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const checkAuthAndFetchUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id });
      setUserRole(roleData);

      if (!roleData || (roleData !== 'agency_admin' && roleData !== 'system_admin')) {
        toast.error("You don't have permission to access this page");
        navigate("/dashboard");
        return;
      }

      await fetchUsers();
    } catch (error: any) {
      toast.error("Failed to load users");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase.rpc('get_user_role', { 
            _user_id: profile.id 
          });
          return {
            id: profile.id,
            email: profile.email,
            created_at: profile.created_at,
            full_name: profile.full_name,
            role: roleData || 'No role assigned',
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error("Failed to fetch users");
      console.error(error);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      "";
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage user accounts and roles</p>
          </div>
          <Button onClick={() => navigate("/users/add")}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="system_admin">System Admin</SelectItem>
              <SelectItem value="agency_admin">Agency Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="scheduler">Scheduler</SelectItem>
              <SelectItem value="hr_staff">HR Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary hover:bg-primary">
                <TableHead className="text-primary-foreground">Username</TableHead>
                <TableHead className="text-primary-foreground">Email</TableHead>
                <TableHead className="text-primary-foreground">Role</TableHead>
                <TableHead className="text-primary-foreground">Password Status</TableHead>
                <TableHead className="text-primary-foreground">Registered</TableHead>
                <TableHead className="text-primary-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || user.email.split("@")[0]}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.role?.includes("admin")
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {user.role?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-600" />
                        Active
                      </span>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary"
                          onClick={() => navigate(`/users/edit/${user.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Role
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-600 hover:text-orange-600"
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Reset Password
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => toast.info("Delete functionality coming soon")}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

    </AppLayout>
  );
};

export default Users;
