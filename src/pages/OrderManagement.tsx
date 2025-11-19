import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Send, Calendar as CalendarIcon, Clock, User, Search, Filter, Trash2, Eye, ChevronDown, ChevronUp, Package, Zap, Star, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addWeeks, addMonths, addYears, subWeeks, subMonths, subYears } from "date-fns";
import { AppLayout } from "@/components/AppLayout";

type Order = {
  id: string;
  order_number: string;
  client_id: string;
  start_date: string;
  end_date: string;
  frequency: string;
  days_of_week: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  clients?: {
    first_name: string;
    last_name: string;
  };
  shift_count?: number;
};

const OrderManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderShifts, setOrderShifts] = useState<{[key: string]: any[]}>({});
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"week" | "month" | "year">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    primaryService: null as any,
    additionalService: null as any,
    client_id: "",
    duration: 0,
    day: null as number | null,
    repeat: "once" as "once" | "weekly" | "biweekly" | "monthly",
    caregiver: null as any,
    time: "",
    startDate: "",
    rate: 35,
  });

  const [availableCaregivers, setAvailableCaregivers] = useState<any[]>([]);
  const [loadingCaregivers, setLoadingCaregivers] = useState(false);
  const [clientCareTypes, setClientCareTypes] = useState<any[]>([]);
  const [loadingClientCareTypes, setLoadingClientCareTypes] = useState(false);

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
        fetchOrders(profileData.agency_id);
        fetchClients(profileData.agency_id);
        fetchCareTypes();
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

  const fetchOrders = async (agencyId: string) => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("client_orders")
      .select(`
        *,
        clients(first_name, last_name)
      `)
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      toast.error("Failed to load orders");
      setLoading(false);
      return;
    }

    // Get shift counts for each order
    const ordersWithCounts = await Promise.all(
      (ordersData || []).map(async (order) => {
        const { count } = await supabase
          .from("shifts")
          .select("*", { count: "exact", head: true })
          .eq("order_id", order.id);
        
        return { ...order, shift_count: count || 0 };
      })
    );

    setOrders(ordersWithCounts as Order[]);
    setFilteredOrders(ordersWithCounts as Order[]);
    setLoading(false);
  };

  const fetchClients = async (agencyId: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .eq("agency_id", agencyId)
      .eq("is_active", true)
      .order("first_name");

    if (error) {
      toast.error("Failed to load clients");
    } else {
      setClients(data || []);
    }
  };

  const fetchCareTypes = async () => {
    const { data, error } = await supabase
      .from("care_types")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("Failed to load care types");
    } else {
      setCareTypes(data || []);
    }
  };

  const handleSaveOrder = async (status: "draft" | "submitted") => {
    if (!bookingData.client_id || !bookingData.primaryService || !bookingData.caregiver ||
        !bookingData.time || bookingData.day === null || !bookingData.startDate) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      const start = bookingData.startDate;
      let end = new Date(start);
      
      if (bookingData.repeat === 'weekly') {
        end.setMonth(end.getMonth() + 3);
      } else if (bookingData.repeat === 'biweekly') {
        end.setMonth(end.getMonth() + 6);
      } else if (bookingData.repeat === 'monthly') {
        end.setMonth(end.getMonth() + 12);
      } else {
        end = new Date(start);
      }

      const { data: newOrderNumber, error: fnError } = await supabase.rpc('generate_order_number');
      if (fnError) throw fnError;

        const { data: newOrder, error: orderError } = await supabase
        .from("client_orders")
        .insert({
          client_id: bookingData.client_id,
          agency_id: profile?.agency_id,
          order_number: newOrderNumber,
          start_date: start,
          end_date: end.toISOString().split('T')[0],
          frequency: bookingData.repeat,
          status,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const shiftsToCreate = [];
      const [timeValue, period] = bookingData.time.split(' ');
      let [hours] = timeValue.split(':').map(Number);
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const startTimeHours = hours;
      const endTimeHours = hours + bookingData.duration;
      const startTime = `${String(startTimeHours).padStart(2, '0')}:00`;
      const endTime = `${String(endTimeHours % 24).padStart(2, '0')}:00`;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === bookingData.day) {
          const shiftDate = d.toISOString().split('T')[0];
          shiftsToCreate.push({
            client_id: bookingData.client_id,
            agency_id: user.id,
            caregiver_id: bookingData.caregiver.id,
            order_id: newOrder.id,
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            duration_hours: bookingData.duration,
            care_type_code: bookingData.primaryService.code,
            status: 'open',
            special_notes: bookingData.additionalService
              ? `Includes ${bookingData.additionalService.name}`
              : null,
            order_title: bookingData.primaryService.name
          });
        }
      }

      const { error: shiftsError } = await supabase.from("shifts").insert(shiftsToCreate);
      if (shiftsError) throw shiftsError;

      toast.success(status === "draft" ? "Order saved as draft" : "Order submitted successfully");
      handleCloseDialog();
      if (user) fetchOrders(user.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
    }
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedOrder(null);
    setStep(1);
    setBookingData({
      primaryService: null,
      additionalService: null,
      client_id: "",
      duration: 0,
      day: null,
      repeat: "once",
      caregiver: null,
      time: "",
      startDate: "",
      rate: 35,
    });
    setAvailableCaregivers([]);
    setClientCareTypes([]);
  };

  const loadClientCareTypes = async (clientId: string) => {
    setLoadingClientCareTypes(true);
    try {
      const { data: careNeeds, error } = await supabase
        .from("client_care_needs")
        .select(`
          care_type_code,
          care_types:care_type_code (
            id,
            code,
            name,
            category,
            description,
            keywords,
            price,
            duration_hours
          )
        `)
        .eq("client_id", clientId);

      if (error) throw error;

      const types = careNeeds?.map((cn: any) => ({
        ...cn.care_types,
        care_type_code: cn.care_type_code
      })) || [];
      
      setClientCareTypes(types);
      
      if (types.length === 0) {
        toast.info("This client has no care types configured. Showing all available services.");
        setClientCareTypes(careTypes);
      }
    } catch (error: any) {
      toast.error("Failed to load client care types");
      setClientCareTypes(careTypes);
    } finally {
      setLoadingClientCareTypes(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order? This will also delete all associated shifts.")) {
      return;
    }

    // Delete shifts for this order (cascade will handle it, but we'll be explicit)
    await supabase.from("shifts").delete().eq("order_id", orderId);

    // Delete order
    const { error } = await supabase
      .from("client_orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to delete order");
    } else {
      toast.success("Order deleted successfully");
      if (user) fetchOrders(user.id);
    }
  };

  const toggleOrderExpand = async (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
      // Fetch shifts for this order if not already loaded
      if (!orderShifts[orderId]) {
        await fetchOrderShifts(orderId);
      }
    }
    setExpandedOrders(newExpanded);
  };

  const fetchOrderShifts = async (orderId: string) => {
    const { data: shifts } = await supabase
      .from("shifts")
      .select("*")
      .eq("order_id", orderId)
      .order("shift_date");

    if (shifts) {
      setOrderShifts(prev => ({ ...prev, [orderId]: shifts }));
    }
  };

  // Search and filter effect
  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order => 
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${order.clients?.first_name} ${order.clients?.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Period filter based on view and currentDate
    const startDate = view === "week" 
      ? startOfWeek(currentDate)
      : view === "month"
      ? startOfMonth(currentDate)
      : startOfYear(currentDate);
    
    const endDate = view === "week"
      ? endOfWeek(currentDate)
      : view === "month"
      ? endOfMonth(currentDate)
      : endOfYear(currentDate);

    filtered = filtered.filter(order => {
      const orderStart = new Date(order.start_date);
      const orderEnd = new Date(order.end_date);
      return orderStart <= endDate && orderEnd >= startDate;
    });

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, view, currentDate, orders]);

  const loadAvailableCaregivers = async () => {
    if (!bookingData.client_id || bookingData.day === null) return;

    setLoadingCaregivers(true);
    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("zip_code")
        .eq("id", bookingData.client_id)
        .single();

      if (!clientData?.zip_code) {
        toast.error("Client zip code not found");
        return;
      }

      const { data: caregivers } = await supabase
        .from("caregivers")
        .select(`
          id, first_name, last_name, hourly_rate, performance_rating,
          service_zipcodes,
          caregiver_availability(day_of_week, start_time, end_time, is_available)
        `)
        .eq("is_active", true);

      const filtered = (caregivers || [])
        .filter((cg) => {
          const serviceZipcodes = cg.service_zipcodes || [];
          if (!serviceZipcodes.includes(clientData.zip_code)) return false;
          
          const daySlot = cg.caregiver_availability?.find(
            (slot: any) => slot.day_of_week === bookingData.day && slot.is_available
          );
          return !!daySlot;
        })
        .sort((a, b) => (b.performance_rating || 0) - (a.performance_rating || 0));

      setAvailableCaregivers(filtered);
      if (filtered.length === 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        toast.info(`No caregivers available on ${dayNames[bookingData.day]}`);
      }
    } catch (error: any) {
      toast.error("Failed to fetch caregivers");
    } finally {
      setLoadingCaregivers(false);
    }
  };

  useEffect(() => {
    if (step === 3 && bookingData.day !== null) {
      loadAvailableCaregivers();
    }
  }, [step, bookingData.day]);

  useEffect(() => {
    if (bookingData.client_id && step === 2) {
      loadClientCareTypes(bookingData.client_id);
    }
  }, [bookingData.client_id, step]);

  const getServiceIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      'Activities of Daily Living (ADL)': '🛁',
      'Instrumental Activities of Daily Living (IADL)': '🏠',
      'Health Monitoring & Care': '❤️',
      'Cognitive & Emotional Support': '🧠',
      'Safety & Transportation': '🚗',
      'Specialized Care': '⚕️',
    };
    return iconMap[category] || '💼';
  };

  const timeSlots = {
    morning: ['6:00', '7:00', '8:00', '9:00', '10:00'],
    afternoon: ['12:00', '1:00', '2:00', '3:00', '4:00'],
    evening: ['6:00', '7:00', '8:00'],
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const servicesToShow = clientCareTypes.length > 0 ? clientCareTypes : careTypes;
  
  const primaryServices = servicesToShow.filter(
    s => s.category === 'Activities of Daily Living (ADL)' ||
         s.category === 'Health Monitoring & Care' ||
         s.category === 'Instrumental Activities of Daily Living (IADL)'
  );

  const additionalServices = servicesToShow.filter(
    s => bookingData.primaryService ? s.code !== bookingData.primaryService.code : true
  );


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
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold">Order Management</h2>
            <p className="text-muted-foreground mt-1">
              {format(currentDate, view === "week" ? "'Week of' MMM d, yyyy" : view === "month" ? "MMMM yyyy" : "yyyy")}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order # or client name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Period Navigation */}
            <div className="flex items-center justify-center gap-2 pb-4 border-b flex-wrap">
              <Button
                variant={view === "week" ? "default" : "outline"}
                onClick={() => setView("week")}
              >
                Week
              </Button>
              <Button
                variant={view === "month" ? "default" : "outline"}
                onClick={() => setView("month")}
              >
                Month
              </Button>
              <Button
                variant={view === "year" ? "default" : "outline"}
                onClick={() => setView("year")}
              >
                Year
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
              <Button
                variant="outline"
                onClick={() => {
                  if (view === "week") {
                    setCurrentDate(subWeeks(currentDate, 1));
                  } else if (view === "month") {
                    setCurrentDate(subMonths(currentDate, 1));
                  } else {
                    setCurrentDate(subYears(currentDate, 1));
                  }
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (view === "week") {
                    setCurrentDate(addWeeks(currentDate, 1));
                  } else if (view === "month") {
                    setCurrentDate(addMonths(currentDate, 1));
                  } else {
                    setCurrentDate(addYears(currentDate, 1));
                  }
                }}
              >
                Next
              </Button>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{orders.length}</div>
                <div className="text-sm text-muted-foreground">Total Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {(() => {
                    const today = new Date().toISOString().split('T')[0];
                    return orders.filter(o => o.start_date <= today && o.end_date >= today && o.status !== 'draft').length;
                  })()}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'draft').length}</div>
                <div className="text-sm text-muted-foreground">Drafts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{orders.reduce((sum, o) => sum + (o.shift_count || 0), 0)}</div>
                <div className="text-sm text-muted-foreground">Total Shifts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {orders.length === 0 ? "No orders found. Create your first order to get started." : "No orders match your filters."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <>
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleOrderExpand(order.id)}
                          >
                            {expandedOrders.has(order.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {order.clients?.first_name} {order.clients?.last_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(order.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(order.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{order.shift_count || 0}</span> shifts
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const today = new Date().toISOString().split('T')[0];
                            const isActive = order.start_date <= today && order.end_date >= today;
                            const isCompleted = order.end_date < today;
                            const isDraft = order.status === 'draft';
                            
                            const displayStatus = isDraft ? 'draft' : isActive ? 'active' : isCompleted ? 'completed' : order.status;
                            
                            return (
                              <Badge variant={
                                isDraft ? "secondary" :
                                isActive ? "default" :
                                isCompleted ? "outline" : "default"
                              }>
                                {displayStatus}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOrderExpand(order.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast.info("Edit feature coming soon");
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(order.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedOrders.has(order.id) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Order Items (Shifts)
                              </h4>
                              {orderShifts[order.id] && orderShifts[order.id].length > 0 ? (
                                <div className="space-y-2">
                                  {orderShifts[order.id].map((shift, idx) => {
                                    const careTypeName = careTypes.find(ct => ct.code === shift.care_type_code)?.name || shift.care_type_code;
                                    return (
                                      <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                        <div className="flex-1 grid grid-cols-5 gap-4">
                                          <div>
                                            <div className="text-sm text-muted-foreground">Date</div>
                                            <div className="font-medium">{new Date(shift.shift_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Care Type</div>
                                            <div className="font-medium">{careTypeName}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Time</div>
                                            <div className="font-medium">{shift.start_time} - {shift.end_time}</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Duration</div>
                                            <div className="font-medium">{shift.duration_hours}h</div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground">Status</div>
                                            <Badge variant={shift.status === 'open' ? 'secondary' : 'default'} className="w-fit">
                                              {shift.status}
                                            </Badge>
                                          </div>
                                        </div>
                                        {shift.special_notes && (
                                          <div className="ml-4 text-sm text-muted-foreground max-w-xs">
                                            {shift.special_notes}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                  Loading shifts...
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div>
                <DialogTitle>Create Care Order</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Step {step} of 4</p>
              </div>
            </DialogHeader>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                  step >= 1 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
                }`}>1</div>
                <div className={`h-1 w-12 transition-all ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                  step >= 2 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
                }`}>2</div>
                <div className={`h-1 w-12 transition-all ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                  step >= 3 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
                }`}>3</div>
                <div className={`h-1 w-12 transition-all ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all ${
                  step >= 4 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'
                }`}>4</div>
              </div>
            </div>

            {/* Step 1: Select Client */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Select Client</h3>
                  <p className="text-sm text-muted-foreground">Choose the client for this care order</p>
                </div>

                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {clients.map((client) => (
                    <Card
                      key={client.id}
                      className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                        bookingData.client_id === client.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setBookingData(prev => ({ ...prev, client_id: client.id }))}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold text-primary-foreground">
                            {client.first_name[0]}{client.last_name[0]}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">
                              {client.first_name} {client.last_name}
                            </h4>
                          </div>
                          {bookingData.client_id === client.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!bookingData.client_id}
                  >
                    Next: Select Services
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Service */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Select Primary Care Service</h3>
                  <p className="text-sm text-muted-foreground">
                    {clientCareTypes.length > 0 
                      ? "Services configured for this client" 
                      : loadingClientCareTypes 
                      ? "Loading client services..." 
                      : "Choose the main care service"}
                  </p>
                </div>
                
                {loadingClientCareTypes ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                    {primaryServices.map((service) => (
                      <Card
                        key={service.id}
                        className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                          bookingData.primaryService?.id === service.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => setBookingData(prev => ({ 
                          ...prev, 
                          primaryService: service,
                          duration: service.duration_hours || 4,
                          rate: service.price || 35
                        }))}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl flex-shrink-0">
                              {getServiceIcon(service.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-base">{service.name}</h4>
                                <Badge variant="secondary" className="shrink-0">${service.price}/hr</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {service.description || service.keywords}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {bookingData.primaryService && (
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold mb-3">Add Another Service? (Optional)</h4>
                    <div className="grid gap-3 max-h-[200px] overflow-y-auto">
                      {additionalServices.slice(0, 5).map((service) => (
                        <Card
                          key={service.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            bookingData.additionalService?.id === service.id
                              ? 'border-primary bg-primary/5 ring-2 ring-primary'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => {
                            if (bookingData.additionalService?.id === service.id) {
                              setBookingData(prev => ({ 
                                ...prev, 
                                additionalService: null,
                                duration: prev.primaryService?.duration_hours || 4,
                                rate: prev.primaryService?.price || 35
                              }));
                            } else {
                              const primaryDuration = bookingData.primaryService?.duration_hours || 4;
                              const additionalDuration = service.duration_hours || 4;
                              const totalDuration = primaryDuration + additionalDuration;
                              const totalRate = (bookingData.primaryService?.price || 35) + (service.price || 35);
                              setBookingData(prev => ({ 
                                ...prev, 
                                additionalService: service,
                                duration: totalDuration,
                                rate: totalRate / 2
                              }));
                            }
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{service.name}</span>
                              <Badge variant="secondary">${service.price}/hr</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                    <Button 
                      onClick={() => setStep(3)}
                      disabled={!bookingData.primaryService}
                    >
                      Next: Schedule
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Schedule Details */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Schedule & Caregiver</h3>
                  <p className="text-sm text-muted-foreground">Choose day, time, and select a caregiver</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Select Day *</Label>
                    <div className="grid grid-cols-7 gap-2">
                      {dayNames.map((day, index) => (
                        <Button
                          key={day}
                          variant={bookingData.day === index ? "default" : "outline"}
                          onClick={() => setBookingData(prev => ({ ...prev, day: index, caregiver: null, time: '' }))}
                          className="text-xs"
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {bookingData.day !== null && (
                    <>
                      <div>
                        <Label>Select Caregiver *</Label>
                        {loadingCaregivers ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : availableCaregivers.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No caregivers available on {dayNames[bookingData.day]}
                          </div>
                        ) : (
                          <div className="grid gap-2 max-h-[250px] overflow-y-auto">
                            {availableCaregivers.map((cg) => (
                              <Card
                                key={cg.id}
                                className={`cursor-pointer transition-all ${
                                  bookingData.caregiver?.id === cg.id
                                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                    : 'hover:border-primary/50'
                                }`}
                                onClick={() => setBookingData(prev => ({ ...prev, caregiver: cg, time: '' }))}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                        {cg.first_name[0]}{cg.last_name[0]}
                                      </div>
                                      <div>
                                        <div className="font-medium">{cg.first_name} {cg.last_name}</div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                          {cg.performance_rating || 5.0}
                                        </div>
                                      </div>
                                    </div>
                                    <Badge variant="secondary">${cg.hourly_rate}/hr</Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      {bookingData.caregiver && (
                        <>
                          <div>
                            <Label>Select Time *</Label>
                            <div className="space-y-3">
                              {Object.entries(timeSlots).map(([period, slots]) => (
                                <div key={period}>
                                  <div className="text-sm font-medium capitalize mb-2">{period}</div>
                                  <div className="grid grid-cols-5 gap-2">
                                    {slots.map((time) => (
                                      <Button
                                        key={time}
                                        variant={bookingData.time === `${time} ${period.toUpperCase()}` ? "default" : "outline"}
                                        onClick={() => setBookingData(prev => ({ 
                                          ...prev, 
                                          time: `${time} ${period.toUpperCase()}`,
                                          rate: prev.caregiver?.hourly_rate || 35
                                        }))}
                                        className="text-xs"
                                      >
                                        {time}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label>Schedule *</Label>
                            <RadioGroup 
                              value={bookingData.repeat}
                              onValueChange={(value: any) => setBookingData(prev => ({ ...prev, repeat: value }))}
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="once" id="once" />
                                <Label htmlFor="once" className="cursor-pointer">One Time Only</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="weekly" id="weekly" />
                                <Label htmlFor="weekly" className="cursor-pointer">Weekly (3 months)</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="biweekly" id="biweekly" />
                                <Label htmlFor="biweekly" className="cursor-pointer">Bi-weekly (6 months)</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="monthly" id="monthly" />
                                <Label htmlFor="monthly" className="cursor-pointer">Monthly (12 months)</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div>
                            <Label>Start Date *</Label>
                            <Input
                              type="date"
                              value={bookingData.startDate}
                              onChange={(e) => setBookingData(prev => ({ ...prev, startDate: e.target.value }))}
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                    <Button 
                      onClick={() => setStep(4)}
                      disabled={!bookingData.caregiver || !bookingData.time || !bookingData.startDate}
                    >
                      Review Order
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Review Your Order</h3>
                  <p className="text-sm text-muted-foreground">Please confirm the details below</p>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Client</div>
                      <div className="font-medium">
                        {clients.find(c => c.id === bookingData.client_id)?.first_name} {clients.find(c => c.id === bookingData.client_id)?.last_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Service</div>
                      <div className="font-medium">{bookingData.primaryService?.name}</div>
                      {bookingData.additionalService && (
                        <div className="text-sm">+ {bookingData.additionalService.name}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Schedule</div>
                      <div className="font-medium">
                        {dayNames[bookingData.day!]} at {bookingData.time}
                      </div>
                      <div className="text-sm">{bookingData.repeat.charAt(0).toUpperCase() + bookingData.repeat.slice(1)}</div>
                      <div className="text-sm">Starting {bookingData.startDate}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Caregiver</div>
                      <div className="font-medium">
                        {bookingData.caregiver?.first_name} {bookingData.caregiver?.last_name}
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-sm text-muted-foreground">Total Cost per Visit</div>
                      <div className="text-2xl font-bold text-primary">
                        ${(bookingData.duration * bookingData.rate).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">{bookingData.duration} hours @ ${bookingData.rate}/hr</div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                    <Button variant="secondary" onClick={() => handleSaveOrder("draft")}>
                      Save as Draft
                    </Button>
                    <Button onClick={() => handleSaveOrder("submitted")}>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Order
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default OrderManagement;