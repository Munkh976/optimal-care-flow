import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Search, Edit, Trash2, Eye, Calendar as CalendarIcon, Table as TableIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parseISO } from "date-fns";

const OrderManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [careTypes, setCareTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCareType, setFilterCareType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteOrder, setDeleteOrder] = useState<any>(null);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarView, setCalendarView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const [formData, setFormData] = useState({
    order_title: "",
    client_id: "",
    care_type: "",
    shift_date: "",
    start_time: "",
    end_time: "",
    duration_hours: "",
    pay_rate: "",
    special_instructions: "",
    is_recurring: false,
    recurrence_pattern: "",
  });

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
    const { data, error } = await supabase
      .from("shifts")
      .select(`
        *,
        clients(first_name, last_name, address, city),
        shift_assignments(caregiver_id, caregivers(first_name, last_name))
      `)
      .eq("agency_id", userId)
      .order("shift_date", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } else {
      setOrders(data || []);
    }
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
    setIsEditMode(false);
    setEditOrder(null);
    setFormData({
      order_title: "",
      client_id: "",
      care_type: "",
      shift_date: "",
      start_time: "",
      end_time: "",
      duration_hours: "",
      pay_rate: "",
      special_instructions: "",
      is_recurring: false,
      recurrence_pattern: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (order: any) => {
    setIsEditMode(true);
    setEditOrder(order);
    setFormData({
      order_title: order.order_title || "",
      client_id: order.client_id || "",
      care_type: order.care_type || "",
      shift_date: order.shift_date || "",
      start_time: order.start_time || "",
      end_time: order.end_time || "",
      duration_hours: order.duration_hours?.toString() || "",
      pay_rate: order.pay_rate?.toString() || "",
      special_instructions: order.special_instructions || "",
      is_recurring: order.is_recurring || false,
      recurrence_pattern: order.recurrence_pattern || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!user || !formData.order_title || !formData.client_id || !formData.care_type || !formData.shift_date || !formData.start_time || !formData.end_time) {
      toast.error("Please fill in all required fields");
      return;
    }

    const orderData: any = {
      order_title: formData.order_title,
      client_id: formData.client_id,
      care_type: formData.care_type,
      shift_date: formData.shift_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
      pay_rate: formData.pay_rate ? parseFloat(formData.pay_rate) : null,
      special_instructions: formData.special_instructions,
      is_recurring: formData.is_recurring,
      recurrence_pattern: formData.recurrence_pattern,
      status: 'open',
    };

    if (isEditMode && editOrder) {
      const { error } = await supabase
        .from("shifts")
        .update(orderData)
        .eq("id", editOrder.id);

      if (error) {
        toast.error("Failed to update order");
        return;
      }

      toast.success("Order updated successfully");
    } else {
      const { error } = await supabase.from("shifts").insert({
        ...orderData,
        agency_id: user.id,
      });

      if (error) {
        toast.error("Failed to add order");
        return;
      }

      toast.success("Order added successfully");
    }

    setIsAddDialogOpen(false);
    if (user) fetchOrders(user.id);
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrder) return;

    const { error } = await supabase
      .from("shifts")
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open': return 'secondary';
      case 'assigned': return 'default';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const filteredOrders = orders.filter(order => {
    const clientName = order.clients ? `${order.clients.first_name} ${order.clients.last_name}` : "";
    const matchesSearch = searchQuery === "" ||
      order.order_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCareType = filterCareType === "all" || order.care_type === filterCareType;
    const matchesStatus = filterStatus === "all" || order.status === filterStatus;

    return matchesSearch && matchesCareType && matchesStatus;
  });

  const calendarEvents = filteredOrders.map(order => ({
    id: order.id,
    title: `${order.order_title} - ${order.clients?.first_name || 'Unknown'}`,
    start: `${order.shift_date}T${order.start_time}`,
    end: `${order.shift_date}T${order.end_time}`,
    backgroundColor: order.status === 'open' ? '#3b82f6' : order.status === 'assigned' ? '#10b981' : '#6b7280',
    borderColor: order.status === 'open' ? '#2563eb' : order.status === 'assigned' ? '#059669' : '#4b5563',
    extendedProps: {
      status: order.status,
      careType: order.care_type,
      clientName: order.clients ? `${order.clients.first_name} ${order.clients.last_name}` : 'Unknown',
    }
  }));

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
            <p className="text-muted-foreground">Manage your care service orders</p>
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
              Add Order
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Search Orders</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by order title or client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Care Type</Label>
                    <Select value={filterCareType} onValueChange={setFilterCareType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Care Types</SelectItem>
                        {careTypes.map(ct => (
                          <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
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
                    <TableHead>Order Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Care Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_title}</TableCell>
                        <TableCell>
                          {order.clients ? `${order.clients.first_name} ${order.clients.last_name}` : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {careTypes.find(ct => ct.code === order.care_type)?.name || order.care_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(parseISO(order.shift_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{order.start_time} - {order.end_time}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.shift_assignments?.[0]?.caregivers 
                            ? `${order.shift_assignments[0].caregivers.first_name} ${order.shift_assignments[0].caregivers.last_name}`
                            : "Unassigned"}
                        </TableCell>
                        <TableCell>
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
                              onClick={() => handleOpenEditDialog(order)}
                            >
                              <Edit className="h-4 w-4" />
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
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-end mb-4">
                <Tabs value={calendarView} onValueChange={(v) => setCalendarView(v as any)}>
                  <TabsList>
                    <TabsTrigger value="dayGridMonth">Monthly</TabsTrigger>
                    <TabsTrigger value="timeGridWeek">Weekly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
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
                  const order = orders.find(o => o.id === info.event.id);
                  if (order) setViewOrder(order);
                }}
              />
            </CardContent>
          </Card>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit Order" : "Add New Order"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="order_title">Order Title *</Label>
                <Input
                  id="order_title"
                  value={formData.order_title}
                  onChange={(e) => setFormData({ ...formData, order_title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
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
                <Label htmlFor="care_type">Care Type *</Label>
                <Select value={formData.care_type} onValueChange={(value) => setFormData({ ...formData, care_type: value })}>
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
                <Label htmlFor="shift_date">Date *</Label>
                <Input
                  id="shift_date"
                  type="date"
                  value={formData.shift_date}
                  onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration_hours">Duration (hours)</Label>
                  <Input
                    id="duration_hours"
                    type="number"
                    step="0.5"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_rate">Pay Rate</Label>
                  <Input
                    id="pay_rate"
                    type="number"
                    step="0.01"
                    value={formData.pay_rate}
                    onChange={(e) => setFormData({ ...formData, pay_rate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="special_instructions">Special Instructions</Label>
                <Input
                  id="special_instructions"
                  value={formData.special_instructions}
                  onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveOrder}>{isEditMode ? "Update" : "Add"} Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {viewOrder && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Order Title</Label>
                  <p className="font-medium">{viewOrder.order_title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p>{viewOrder.clients ? `${viewOrder.clients.first_name} ${viewOrder.clients.last_name}` : "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Care Type</Label>
                  <p>{careTypes.find(ct => ct.code === viewOrder.care_type)?.name || viewOrder.care_type}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Date</Label>
                    <p>{format(parseISO(viewOrder.shift_date), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Time</Label>
                    <p>{viewOrder.start_time} - {viewOrder.end_time}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(viewOrder.status)}>{viewOrder.status}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assigned To</Label>
                  <p>{viewOrder.shift_assignments?.[0]?.caregivers 
                    ? `${viewOrder.shift_assignments[0].caregivers.first_name} ${viewOrder.shift_assignments[0].caregivers.last_name}`
                    : "Unassigned"}</p>
                </div>
                {viewOrder.special_instructions && (
                  <div>
                    <Label className="text-muted-foreground">Special Instructions</Label>
                    <p>{viewOrder.special_instructions}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteOrder} onOpenChange={() => setDeleteOrder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this order? This action cannot be undone.
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
