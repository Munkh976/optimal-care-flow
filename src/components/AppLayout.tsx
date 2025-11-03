import { ReactNode, useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.rpc('get_user_role', { _user_id: user.id });
        setUserRole(data);
      }
    };
    fetchUserRole();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      roles: ["agency_admin", "manager", "scheduler"],
    },
    {
      label: "Schedule",
      icon: Calendar,
      path: "/schedule",
      roles: ["agency_admin", "manager", "scheduler", "caregiver"],
    },
    {
      label: "Caregivers",
      icon: Users,
      path: "/caregivers",
      roles: ["agency_admin", "manager", "hr_staff"],
    },
    {
      label: "Clients",
      icon: UserCog,
      path: "/clients",
      roles: ["agency_admin", "manager"],
    },
    {
      label: "Care Types",
      icon: Tag,
      path: "/care-types",
      roles: ["agency_admin", "manager"],
    },
    {
      label: "Care Needs",
      icon: List,
      path: "/care-needs",
      roles: ["agency_admin", "manager"],
    },
    {
      label: "Users",
      icon: UserCheck,
      path: "/users",
      roles: ["agency_admin", "system_admin"],
    },
    {
      label: "Time Off",
      icon: Clock,
      path: "/time-off",
      roles: ["agency_admin", "manager", "scheduler"],
    },
    {
      label: "Live Operations",
      icon: Radio,
      path: "/live-operations",
      roles: ["agency_admin", "manager", "scheduler"],
    },
    {
      label: "Unassigned Shifts",
      icon: ClipboardList,
      path: "/unassigned-shifts",
      roles: ["agency_admin", "manager", "scheduler"],
    },
    {
      label: "Shift Trades",
      icon: Repeat,
      path: "/shift-trades",
      roles: ["agency_admin", "manager", "scheduler"],
    },
    {
      label: "Caregiver Approvals",
      icon: UserPlus,
      path: "/caregiver-approvals",
      roles: ["agency_admin", "manager", "hr_staff"],
    },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    !item.roles || (userRole && item.roles.includes(userRole))
  );

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

          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {filteredMenuItems.map((item) => {
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
