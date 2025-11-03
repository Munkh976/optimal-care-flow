import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Phone, Mail, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Caregiver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  performance_rating: number;
}

interface CareTeamProps {
  clientId: string | null;
}

export const CareTeam = ({ clientId }: CareTeamProps) => {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      fetchCaregivers();
    }
  }, [clientId]);

  const fetchCaregivers = async () => {
    if (!clientId) return;

    try {
      // Get caregivers assigned to this client's shifts
      const { data: shifts, error: shiftsError } = await supabase
        .from("shifts")
        .select("caregiver_id")
        .eq("client_id", clientId)
        .not("caregiver_id", "is", null);

      if (shiftsError) throw shiftsError;

      if (shifts && shifts.length > 0) {
        const caregiverIds = [...new Set(shifts.map(s => s.caregiver_id))].filter(Boolean);

        const { data: caregiversData, error: caregiversError } = await supabase
          .from("caregivers")
          .select("id, first_name, last_name, email, phone, role, performance_rating")
          .in("id", caregiverIds);

        if (caregiversError) throw caregiversError;
        setCaregivers(caregiversData || []);
      }
    } catch (error: any) {
      toast.error("Failed to load care team");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Care Team</h2>
        <p className="text-sm text-muted-foreground">Your assigned caregivers</p>
      </div>

      {caregivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No caregivers assigned yet</p>
            <p className="text-sm text-muted-foreground">Your care team will appear here once shifts are assigned</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {caregivers.map((caregiver) => (
            <Card key={caregiver.id} className="hover-scale">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(caregiver.first_name, caregiver.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {caregiver.first_name} {caregiver.last_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {caregiver.role.replace('_', ' ')}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="text-xs">{caregiver.performance_rating?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{caregiver.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{caregiver.email}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
