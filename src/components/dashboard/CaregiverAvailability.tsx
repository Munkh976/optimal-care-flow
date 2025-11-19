import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

const CaregiverAvailability = () => {
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCaregivers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        console.error("Profile not found for user", user.id);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("caregivers")
        .select("*")
        .eq("agency_id", profile.agency_id)
        .eq("is_active", true)
        .order("first_name", { ascending: true })
        .limit(8);

      if (error) {
        console.error("Error fetching caregivers:", error);
      } else {
        setCaregivers(data || []);
      }
      
      setLoading(false);
    };

    fetchCaregivers();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case "full_time":
        return "bg-primary/10 text-primary";
      case "part_time":
        return "bg-accent/10 text-accent";
      case "on_call":
        return "bg-warning/10 text-warning";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Caregivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Caregivers</CardTitle>
        <CardDescription>Your available care team</CardDescription>
      </CardHeader>
      <CardContent>
        {caregivers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No active caregivers</p>
        ) : (
          <div className="space-y-3">
            {caregivers.map((caregiver) => (
              <div key={caregiver.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <div className="p-2 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {caregiver.first_name} {caregiver.last_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={getRoleColor(caregiver.role)}>
                      {caregiver.role.replace("_", " ")}
                    </Badge>
                    {caregiver.certifications && caregiver.certifications.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {caregiver.certifications.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CaregiverAvailability;