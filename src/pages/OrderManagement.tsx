import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Search, Edit, Trash2, Eye, Calendar as CalendarIcon, Table as TableIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parseISO, addDays, startOfWeek, endOfWeek } from "date-fns";

const OrderManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteOrder, setDeleteOrder] = useState<any>(null);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarView, setCalendarView] = useState<"dayGridMonth" | "timeGridWeek">("timeGridWeek");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    client_id: "",
    start_date: "",
    end_date: "",
    frequency: "weekly",
    days_of_week: [] as string[],
    notes: "",
  });
  const [selectedShifts, setSelectedShifts] = useState<any[]>([
    { care_type: "", shift_date: "", start_time: "08:00", end_time: "12:00", duration_hours: 4 }
  ]);

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
        fetchOrders(session.user.id);
        fetchClients(session.user.id);
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

  const fetchOrders = async (userId: string) => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("client_orders")
      .select(`
        *,
        clients(first_name, last_name, address, city)
      `)
      .eq("agency_id", userId)
      .order("start_date", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      toast.error("Failed to load orders");
      setLoading(false);
      return;
    }

    // Fetch shifts for each order
    const ordersWithShifts = await Promise.all(
      (ordersData || []).map(async (order) => {
        const { data: orderShifts } = await supabase
          .from("order_shifts")
          .select(`
            shift_id,
            shifts(
              *,
              shift_assignments(caregiver_id, caregivers(first_name, last_name))
            )
          `)
          .eq("order_id", order.id);

        return {
          ...order,
          shifts: orderShifts?.map(os => os.shifts) || []
        };
      })
    );

    setOrders(ordersWithShifts || []);
    setLoading(false);
  };

  const fetchClients = async (userId: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", userId)
      .eq("is_active", true)
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
    } else {
      setClients(data || []);
    }
  };

  const fetchCareTypes = async () => {
    const { data, error } = await supabase
      .from("care_types")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching care types:", error);
    } else {
      setCareTypes(data || []);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleOpenAddDialog = () => {
    const nextMonday = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 });
    
    setFormData({
      client_id: "",
      start_date: format(nextMonday, "yyyy-MM-dd"),
      end_date: format(nextSunday, "yyyy-MM-dd"),
      frequency: "weekly",
      days_of_week: [],
      notes: "",
    });
    setSelectedShifts([
      { care_type: "", shift_date: format(nextMonday, "yyyy-MM-dd"), start_time: "08:00", end_time: "12:00", duration_hours: 4 }
    ]);
    setIsAddDialogOpen(true);
  };

  const handleAddShift = () => {
    setSelectedShifts([...selectedShifts, {
      care_type: "",
      shift_date: formData.start_date,
      start_time: "08:00",
      end_time: "12:00",
      duration_hours: 4
    }]);
  };

  const handleRemoveShift = (index: number) => {
    setSelectedShifts(selectedShifts.filter((_, i) => i !== index));
  };

  const handleShiftChange = (index: number, field: string, value: any) => {
    const updated = [...selectedShifts];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate duration if start/end time changes
    if (field === "start_time" || field === "end_time") {
      const start = field === "start_time" ? value : updated[index].start_time;
      const end = field === "end_time" ? value : updated[index].end_time;
      if (start && end) {
        const [startH, startM] = start.split(":").map(Number);
        const [endH, endM] = end.split(":").map(Number);
        const duration = (endH + endM / 60) - (startH + startM / 60);
        updated[index].duration_hours = duration;
      }
    }
    
    setSelectedShifts(updated);
  };

  const handleSaveOrder = async () => {
    if (!user || !formData.client_id || !formData.start_date || !formData.end_date || selectedShifts.length === 0) {
      toast.error("Please fill in all required fields and add at least one shift");
      return;
    }

    // Validate shifts
    for (const shift of selectedShifts) {
      if (!shift.care_type || !shift.shift_date || !shift.start_time || !shift.end_time) {
        toast.error("Please complete all shift details");
        return;
      }
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    // Create order
    const { data: newOrder, error: orderError } = await supabase
      .from("client_orders")
      .insert({
        agency_id: user.id,
        client_id: formData.client_id,
        order_number: orderNumber,
        start_date: formData.start_date,
        end_date: formData.end_date,
        frequency: formData.frequency,
        days_of_week: formData.days_of_week.join(","),
        status: "active",
        notes: formData.notes,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      toast.error("Failed to create order");
      console.error(orderError);
      return;
    }

    // Create shifts
    const shiftInserts = selectedShifts.map(shift => ({
      agency_id: user.id,
      client_id: formData.client_id,
      care_type: shift.care_type,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      duration_hours: shift.duration_hours,
      status: 'open' as any,
      order_title: careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type,
    }));

    const { data: newShifts, error: shiftsError } = await supabase
      .from("shifts")
      .insert(shiftInserts)
      .select();

    if (shiftsError || !newShifts) {
      toast.error("Failed to create shifts");
      console.error(shiftsError);
      return;
    }

    // Link shifts to order
    const orderShiftInserts = newShifts.map(shift => ({
      order_id: newOrder.id,
      shift_id: shift.id,
    }));

    const { error: linkError } = await supabase
      .from("order_shifts")
      .insert(orderShiftInserts);

    if (linkError) {
      toast.error("Failed to link shifts to order");
      console.error(linkError);
      return;
    }

    toast.success("Order created successfully");
    setIsAddDialogOpen(false);
    if (user) fetchOrders(user.id);
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrder) return;

    // Delete order (cascade will handle order_shifts and shifts)
    const { error } = await supabase
      .from("client_orders")
      .delete()
      .eq("id", deleteOrder.id);

    if (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete order");
    } else {
      toast.success("Order deleted successfully");
      setDeleteOrder(null);
      if (user) fetchOrders(user.id);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  };

  const filteredOrders = orders.filter(order => {
    const clientName = order.clients ? `${order.clients.first_name} ${order.clients.last_name}` : "";
    const matchesSearch = searchQuery === "" ||
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "all" || order.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Generate calendar events from all shifts in all orders
  const calendarEvents = filteredOrders.flatMap(order =>
    order.shifts?.map((shift: any) => {
      const careTypeName = careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type;
      return {
        id: shift.id,
        title: `${careTypeName} - ${order.clients?.first_name || 'Unknown'}`,
        start: `${shift.shift_date}T${shift.start_time}`,
        end: `${shift.shift_date}T${shift.end_time}`,
        backgroundColor: shift.status === 'open' ? '#3b82f6' : shift.status === 'assigned' ? '#10b981' : '#6b7280',
        borderColor: shift.status === 'open' ? '#2563eb' : shift.status === 'assigned' ? '#059669' : '#4b5563',
        extendedProps: {
          orderNumber: order.order_number,
          status: shift.status,
          careType: shift.care_type,
          clientName: order.clients ? `${order.clients.first_name} ${order.clients.last_name}` : 'Unknown',
        }
      };
    }) || []
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading orders...</p>
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
            <h2 className="text-3xl font-bold mb-2">Order Management</h2>
            <p className="text-muted-foreground">Manage weekly care service orders (collections of shifts)</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button className="gap-2" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          </div>
        </div>

        {viewMode === "table" ? (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Search & Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Search Orders</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by order number or client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Shifts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <>
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleOrderExpansion(order.id)}>
                          <TableCell>
                            {expandedOrders.has(order.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>
                            {order.clients ? `${order.clients.first_name} ${order.clients.last_name}` : "Unknown"}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(order.start_date), "MMM dd")} - {format(parseISO(order.end_date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{order.shifts?.length || 0} shifts</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewOrder(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteOrder(order)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedOrders.has(order.id) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30">
                              <div className="p-4 space-y-2">
                                <h4 className="font-semibold mb-3">Shifts in this order:</h4>
                                {order.shifts?.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No shifts in this order</p>
                                ) : (
                                  <div className="space-y-2">
                                    {order.shifts?.map((shift: any) => {
                                      const careTypeName = careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type;
                                      return (
                                        <div key={shift.id} className="flex items-center justify-between bg-background p-3 rounded-lg border">
                                          <div className="flex gap-4 flex-1">
                                            <div>
                                              <span className="text-sm font-medium">{careTypeName}</span>
                                            </div>
                                            <div>
                                              <span className="text-sm text-muted-foreground">
                                                {format(parseISO(shift.shift_date), "EEE, MMM dd")}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-sm text-muted-foreground">
                                                {shift.start_time} - {shift.end_time}
                                              </span>
                                            </div>
                                            <div>
                                              <Badge variant={shift.status === 'open' ? 'secondary' : 'default'}>
                                                {shift.status}
                                              </Badge>
                                            </div>
                                          </div>
                                          <div>
                                            {shift.shift_assignments?.[0]?.caregivers ? (
                                              <span className="text-sm">
                                                {shift.shift_assignments[0].caregivers.first_name} {shift.shift_assignments[0].caregivers.last_name}
                                              </span>
                                            ) : (
                                              <span className="text-sm text-muted-foreground">Unassigned</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <Tabs value={calendarView} onValueChange={(v) => setCalendarView(v as any)}>
                <TabsList>
                  <TabsTrigger value="dayGridMonth">Month</TabsTrigger>
                  <TabsTrigger value="timeGridWeek">Week</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={calendarView}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: ''
                }}
                events={calendarEvents}
                height="auto"
                eventClick={(info) => {
                  const orderId = info.event.extendedProps.orderNumber;
                  const order = orders.find(o => o.order_number === orderId);
                  if (order) setViewOrder(order);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Add Order Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.first_name} {client.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes for this order"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Shifts</h3>
                  <Button onClick={handleAddShift} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Shift
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {selectedShifts.map((shift, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Care Type *</Label>
                            <Select
                              value={shift.care_type}
                              onValueChange={(v) => handleShiftChange(index, "care_type", v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select care type" />
                              </SelectTrigger>
                              <SelectContent>
                                {careTypes.map(ct => (
                                  <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input
                              type="date"
                              value={shift.shift_date}
                              onChange={(e) => handleShiftChange(index, "shift_date", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Start Time *</Label>
                            <Input
                              type="time"
                              value={shift.start_time}
                              onChange={(e) => handleShiftChange(index, "start_time", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>End Time *</Label>
                            <Input
                              type="time"
                              value={shift.end_time}
                              onChange={(e) => handleShiftChange(index, "end_time", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Duration (hours)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={shift.duration_hours}
                              onChange={(e) => handleShiftChange(index, "duration_hours", parseFloat(e.target.value))}
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="destructive"
                              onClick={() => handleRemoveShift(index)}
                              disabled={selectedShifts.length === 1}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveOrder}>Create Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Order Dialog */}
        <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {viewOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Order Number</Label>
                    <p className="font-medium">{viewOrder.order_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant={getStatusBadgeVariant(viewOrder.status)}>
                        {viewOrder.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Client</Label>
                    <p className="font-medium">
                      {viewOrder.clients ? `${viewOrder.clients.first_name} ${viewOrder.clients.last_name}` : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Week</Label>
                    <p className="font-medium">
                      {format(parseISO(viewOrder.start_date), "MMM dd")} - {format(parseISO(viewOrder.end_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Frequency</Label>
                    <p className="font-medium capitalize">{viewOrder.frequency}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Shifts</Label>
                    <p className="font-medium">{viewOrder.shifts?.length || 0}</p>
                  </div>
                </div>
                {viewOrder.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="font-medium">{viewOrder.notes}</p>
                  </div>
                )}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Shifts</h4>
                  <div className="space-y-2">
                    {viewOrder.shifts?.map((shift: any) => {
                      const careTypeName = careTypes.find(ct => ct.code === shift.care_type)?.name || shift.care_type;
                      return (
                        <div key={shift.id} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                          <div className="flex gap-4 flex-1">
                            <span className="font-medium">{careTypeName}</span>
                            <span className="text-muted-foreground">
                              {format(parseISO(shift.shift_date), "EEE, MMM dd")}
                            </span>
                            <span className="text-muted-foreground">
                              {shift.start_time} - {shift.end_time}
                            </span>
                            <Badge variant={shift.status === 'open' ? 'secondary' : 'default'}>
                              {shift.status}
                            </Badge>
                          </div>
                          <div>
                            {shift.shift_assignments?.[0]?.caregivers ? (
                              <span className="text-sm">
                                {shift.shift_assignments[0].caregivers.first_name} {shift.shift_assignments[0].caregivers.last_name}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewOrder(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteOrder} onOpenChange={() => setDeleteOrder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete order {deleteOrder?.order_number} and all its associated shifts. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteOrder}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default OrderManagement;
