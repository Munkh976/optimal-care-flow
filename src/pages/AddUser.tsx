import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

const AddUser = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("scheduler");
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id });
    if (!roleData || (roleData !== 'agency_admin' && roleData !== 'system_admin')) {
      toast.error("You don't have permission to access this page");
      navigate("/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Valid email is required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{
          user_id: authData.user.id,
          role: role as any,
        }]);

      if (roleError) throw roleError;

      toast.success("User created successfully!");
      navigate("/users");
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/users")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle>Add New User</CardTitle>
            <CardDescription>Create a new user account</CardDescription>
            <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1 rounded-md text-sm mx-auto mt-2">
              <span className="font-medium">⚠ Admin Only</span>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Account Type</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system_admin">System Admin - Full system access</SelectItem>
                    <SelectItem value="agency_admin">Agency Admin - Manage agency</SelectItem>
                    <SelectItem value="manager">Manager - Manage operations</SelectItem>
                    <SelectItem value="scheduler">Scheduler - Schedule management</SelectItem>
                    <SelectItem value="hr_staff">HR Staff - HR operations</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  As a system admin, you can create both user and admin accounts
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requirePasswordChange"
                  checked={requirePasswordChange}
                  onCheckedChange={(checked) => setRequirePasswordChange(checked as boolean)}
                />
                <Label htmlFor="requirePasswordChange" className="text-sm font-normal cursor-pointer">
                  Require password change on first login
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, the user will be forced to change their password when they first log in. This is recommended for security.
              </p>

              <Button type="submit" className="w-full" disabled={loading}>
                <UserPlus className="mr-2 h-4 w-4" />
                {loading ? "Creating user..." : "Add User"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AddUser;
