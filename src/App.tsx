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
import EditUser from "./pages/EditUser";
import UserRoles from "./pages/UserRoles";
import SystemRoles from "./pages/SystemRoles";
import RolePermissions from "./pages/RolePermissions";
import SystemAdminDashboard from "./pages/SystemAdminDashboard";
import AdminUtilities from "./pages/AdminUtilities";
import AgencySettings from "./pages/AgencySettings";
import CareTypes from "./pages/CareTypes";
import OrderManagement from "./pages/OrderManagement";
import NotFound from "./pages/NotFound";
import AvailableShifts from "./pages/AvailableShifts";
import CaregiverTimeOff from "./pages/CaregiverTimeOff";
import CaregiverSettings from "./pages/CaregiverSettings";
import AutoSchedule from "./pages/AutoSchedule";
import Reports from "./pages/Reports";
import AdminUserManagement from "./pages/AdminUserManagement";

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
          <Route path="/users/edit/:id" element={<EditUser />} />
          <Route path="/user-roles" element={<UserRoles />} />
          <Route path="/system-roles" element={<SystemRoles />} />
          <Route path="/role-permissions" element={<RolePermissions />} />
          <Route path="/system-admin-dashboard" element={<SystemAdminDashboard />} />
          <Route path="/system-admin" element={<SystemAdminDashboard />} />
          <Route path="/care-types" element={<CareTypes />} />
          <Route path="/order-management" element={<OrderManagement />} />
          <Route path="/available-shifts" element={<AvailableShifts />} />
          <Route path="/caregiver-time-off" element={<CaregiverTimeOff />} />
          <Route path="/caregiver-settings" element={<CaregiverSettings />} />
          <Route path="/admin-utilities" element={<AdminUtilities />} />
          <Route path="/agency-settings" element={<AgencySettings />} />
          <Route path="/auto-schedule" element={<AutoSchedule />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin-user-management" element={<AdminUserManagement />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
