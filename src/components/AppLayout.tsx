import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  Clock,
  Radio,
  Repeat,
  ClipboardList,
  UserPlus,
  UserCheck,
  LogOut,
  Menu,
  X,
  Tag,
  List,
  FileText,
  Settings,
  Shield,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { permissions, userRole, loading } = usePermissions();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  // Icon mapping for modules
  const iconMap: Record<string, any> = {
    users: UserCheck,
    user_roles: UserCog,
    system_roles: Shield,
    role_permissions: Settings,
    caregivers: Users,
    clients: UserCog,
    shifts: Calendar,
    orders: FileText,
    availability: Clock,
    time_off: Clock,
    shift_trades: Repeat,
    care_types: Tag,
    care_needs: List,
    agency: Settings,
    agency_settings: Building2,
    auto_schedule: Calendar,
    available_shifts: ClipboardList,
    caregiver_approvals: UserCheck,
    caregiver_registration: UserPlus,
    live_operations: Radio,
    quick_assign: UserCog,
    reports: FileText,
    caregiver_dashboard: LayoutDashboard,
    caregiver_time_off: Clock,
    caregiver_settings: Settings,
    client_dashboard: LayoutDashboard,
  };

  // Build menu items from permissions
  const dynamicMenuItems = permissions
    .filter(p => p.route && p.can_read)
    .map(p => ({
      label: p.module_name,
      icon: iconMap[p.module_code] || FileText,
      path: p.route!,
      category: p.category,
    }));

  // Add dashboard as first item based on role
  const menuItems = userRole === "system_admin" 
    ? [
        {
          label: "System Admin",
          icon: Shield,
          path: "/system-admin",
          category: "dashboard",
        },
        ...dynamicMenuItems,
      ]
    : userRole === "caregiver"
    ? dynamicMenuItems // Caregivers use their own dashboard from permissions
    : userRole === "client"
    ? dynamicMenuItems // Clients use their own dashboard from permissions
    : [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          path: "/dashboard",
          category: "dashboard",
        },
        ...dynamicMenuItems,
      ];

  // Group by category
  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold text-primary">CareMuch</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {userRole?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </p>
          </div>

          <nav className="flex-1 space-y-4 p-4 overflow-y-auto">
            {loading ? (
              <div className="text-center text-muted-foreground text-sm">Loading...</div>
            ) : (
              Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive(item.path)
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </nav>

          <div className="border-t p-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 transition-all ${isSidebarOpen ? "md:ml-64" : ""}`}>
        <div className="container mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};
