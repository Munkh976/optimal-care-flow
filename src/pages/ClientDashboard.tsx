import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/AppLayout";
import { 
  Home, Package, Calendar, Users, History, Settings
} from "lucide-react";
import { Overview } from "@/components/client-dashboard/Overview";
import { OrdersManagement } from "@/components/client-dashboard/OrdersManagement";
import { MySchedule } from "@/components/client-dashboard/MySchedule";
import { CareTeam } from "@/components/client-dashboard/CareTeam";
import { CareHistory } from "@/components/client-dashboard/CareHistory";
import { ProfileSettings } from "@/components/client-dashboard/ProfileSettings";

interface ClientProfile {
  id: string;
  first_name: string;
  last_name: string;
  agency_id: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_conditions: string[];
  notes: string | null;
}

interface CareType {
  id: string;
  care_type_code: string;
  priority: number;
  notes: string | null;
  care_types: {
    name: string;
    code: string;
    category: string;
    description: string | null;
    keywords: string | null;
    price: number;
    duration_hours: number;
  };
}

interface Order {
  id: string;
  order_number: string;
  start_date: string;
  end_date: string;
  status: string;
  frequency: string;
  days_of_week: string | null;
  created_at: string;
}

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [availableCareTypes, setAvailableCareTypes] = useState<CareType[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    activeOrders: 0,
    upcomingShifts: 0,
    totalCareHours: 0,
    assignedCaregivers: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    await fetchClientData(session.user.id);
    setLoading(false);
  };

  const fetchClientData = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (clientData) {
      setClientProfile(clientData);
      
      // Fetch orders
      const { data: ordersData } = await supabase
        .from("client_orders")
        .select("*")
        .eq("client_id", clientData.id)
        .in("status", ["active", "submitted"]);
      
      // Fetch upcoming shifts
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("*")
        .eq("client_id", clientData.id)
        .gte("shift_date", today)
        .lte("shift_date", nextWeek.toISOString().split('T')[0]);
      
      // Fetch caregivers
      const { data: caregiverShifts } = await supabase
        .from("shifts")
        .select("caregiver_id")
        .eq("client_id", clientData.id)
        .not("caregiver_id", "is", null);
      
      const uniqueCaregivers = new Set(caregiverShifts?.map(s => s.caregiver_id) || []);
      
      // Calculate total hours this month
      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: monthShifts } = await supabase
        .from("shifts")
        .select("duration_hours")
        .eq("client_id", clientData.id)
        .eq("status", "completed")
        .gte("shift_date", monthStart.toISOString().split('T')[0]);
      
      const totalHours = monthShifts?.reduce((sum, s) => sum + (s.duration_hours || 0), 0) || 0;
      
      setStats({
        activeOrders: ordersData?.length || 0,
        upcomingShifts: shiftsData?.length || 0,
        totalCareHours: totalHours,
        assignedCaregivers: uniqueCaregivers.size
      });
      
      // Fetch current order
      const { data: currentOrderData } = await supabase
        .from("client_orders")
        .select("*")
        .eq("client_id", clientData.id)
        .in("status", ["draft", "submitted", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setCurrentOrder(currentOrderData || null);
      
      // Fetch care types
      const { data: careTypesData } = await supabase
        .from("client_care_needs")
        .select(`
          id,
          care_type_code,
          priority,
          notes,
          care_types:care_type_code(
            name,
            code,
            category,
            description,
            keywords,
            price,
            duration_hours
          )
        `)
        .eq("client_id", clientData.id)
        .order("priority", { ascending: false });

      setAvailableCareTypes(careTypesData || []);
    } else {
      toast.error("Client profile not found. Please contact your agency.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Welcome, {clientProfile?.first_name}</h1>
          <p className="text-sm text-muted-foreground">Client Dashboard</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-2">
            <TabsTrigger value="overview" className="gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Care Team</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Overview
              clientProfile={clientProfile}
              stats={stats}
              onCreateOrder={() => setActiveTab("orders")}
              onViewSchedule={() => setActiveTab("schedule")}
            />
          </TabsContent>

          <TabsContent value="orders">
            <OrdersManagement
              clientProfile={clientProfile}
              user={user}
              availableCareTypes={availableCareTypes}
              currentOrder={currentOrder}
              onRefresh={() => fetchClientData(user.id)}
            />
          </TabsContent>

          <TabsContent value="schedule">
            <MySchedule clientProfile={clientProfile} />
          </TabsContent>

          <TabsContent value="team">
            <CareTeam clientId={clientProfile?.id || null} />
          </TabsContent>

          <TabsContent value="history">
            <CareHistory clientId={clientProfile?.id || null} />
          </TabsContent>

          <TabsContent value="settings">
            <ProfileSettings
              clientProfile={clientProfile}
              userEmail={user?.email || ""}
              onRefresh={() => fetchClientData(user.id)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
