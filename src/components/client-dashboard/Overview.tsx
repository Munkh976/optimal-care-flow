import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Calendar, Clock, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OverviewProps {
  clientProfile: {
    first_name: string;
    last_name: string;
  } | null;
  stats: {
    activeOrders: number;
    upcomingShifts: number;
    totalCareHours: number;
    assignedCaregivers: number;
  };
  onCreateOrder: () => void;
  onViewSchedule: () => void;
}

export const Overview = ({ clientProfile, stats, onCreateOrder, onViewSchedule }: OverviewProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back, {clientProfile?.first_name}! 👋</CardTitle>
          <CardDescription>
            Here's an overview of your care services
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOrders}</div>
            <p className="text-xs text-muted-foreground">Current care orders</p>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Shifts</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingShifts}</div>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Care Hours</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCareHours}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Care Team</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignedCaregivers}</div>
            <p className="text-xs text-muted-foreground">Assigned caregivers</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you can perform</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Button onClick={onCreateOrder} className="h-auto flex-col gap-2 py-4">
            <Plus className="h-6 w-6" />
            <span className="font-semibold">Create New Order</span>
            <span className="text-xs opacity-90">Start a new care order</span>
          </Button>
          <Button onClick={onViewSchedule} variant="outline" className="h-auto flex-col gap-2 py-4">
            <Calendar className="h-6 w-6" />
            <span className="font-semibold">View Schedule</span>
            <span className="text-xs opacity-90">See upcoming care sessions</span>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest care service updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b last:border-0">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Order Created</p>
                <p className="text-xs text-muted-foreground">Weekly care order for next month</p>
                <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
              </div>
              <Badge variant="secondary">New</Badge>
            </div>
            <div className="flex items-start gap-4 pb-4 border-b last:border-0">
              <div className="w-2 h-2 rounded-full bg-muted mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Shift Completed</p>
                <p className="text-xs text-muted-foreground">Morning care session completed</p>
                <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
              </div>
              <Badge variant="outline">Completed</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
