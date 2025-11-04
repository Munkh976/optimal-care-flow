import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Caregivers from "./pages/Caregivers";
import Clients from "./pages/Clients";
import TimeOffRequests from "./pages/TimeOffRequests";
import LiveOperations from "./pages/LiveOperations";
import QuickAssign from "./pages/QuickAssign";
import ShiftTrades from "./pages/ShiftTrades";
import CaregiverDashboard from "./pages/CaregiverDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import CaregiverRegistration from "./pages/CaregiverRegistration";
import CaregiverApprovals from "./pages/CaregiverApprovals";
import Users from "./pages/Users";
import AddUser from "./pages/AddUser";
import SystemAdminDashboard from "./pages/SystemAdminDashboard";
import CareTypes from "./pages/CareTypes";
import CareNeeds from "./pages/CareNeeds";
import OrderManagement from "./pages/OrderManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/caregivers" element={<Caregivers />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/time-off" element={<TimeOffRequests />} />
          <Route path="/live-operations" element={<LiveOperations />} />
          <Route path="/quick-assign" element={<QuickAssign />} />
          <Route path="/shift-trades" element={<ShiftTrades />} />
          <Route path="/caregiver-registration" element={<CaregiverRegistration />} />
          <Route path="/caregiver-approvals" element={<CaregiverApprovals />} />
          <Route path="/caregiver-dashboard" element={<CaregiverDashboard />} />
          <Route path="/client-dashboard" element={<ClientDashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/add" element={<AddUser />} />
          <Route path="/system-admin-dashboard" element={<SystemAdminDashboard />} />
          <Route path="/care-types" element={<CareTypes />} />
          <Route path="/care-needs" element={<CareNeeds />} />
          <Route path="/order-management" element={<OrderManagement />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
