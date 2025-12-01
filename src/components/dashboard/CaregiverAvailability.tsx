import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CaregiverWithAvailability {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  skills: { care_type_code: string }[];
  availability: { 
    id: string;
    day_of_week: number;
    is_available: boolean;
    start_time: string;
    end_time: string;
  }[];
}

const CaregiverAvailability = () => {
  const [caregivers, setCaregivers] = useState<CaregiverWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCaregivers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("agency_id")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          toast({
            title: "Error",
            description: "Failed to load your profile",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        const today = new Date().getDay();
        
        const { data, error } = await supabase
          .from("caregivers")
          .select(`
            id,
            first_name,
            last_name,
            role,
            skills:caregiver_skills(care_type_code),
            availability:caregiver_availability(id, day_of_week, is_available, start_time, end_time)
          `)
          .eq("agency_id", profile.agency_id)
          .eq("is_active", true)
          .order("first_name", { ascending: true })
          .limit(8);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to load caregivers",
            variant: "destructive"
          });
          console.error("Error fetching caregivers:", error);
        } else {
          setCaregivers(data || []);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCaregivers();
  }, [toast]);

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

  const getTodayAvailability = (caregiver: CaregiverWithAvailability) => {
    const today = new Date().getDay();
    const todaySchedule = caregiver.availability.find(
      av => av.day_of_week === today && av.is_available
    );
    
    if (!todaySchedule) {
      return { available: false, time: "" };
    }
    
    return {
      available: true,
      time: `${todaySchedule.start_time.slice(0, 5)} - ${todaySchedule.end_time.slice(0, 5)}`
    };
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
            {caregivers.map((caregiver) => {
              const todayAvailability = getTodayAvailability(caregiver);
              
              return (
                <div key={caregiver.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="p-2 rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {caregiver.first_name} {caregiver.last_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className={getRoleColor(caregiver.role)}>
                        {caregiver.role.replace("_", " ")}
                      </Badge>
                      {caregiver.skills && caregiver.skills.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">
                          {caregiver.skills.slice(0, 2).map(s => s.care_type_code).join(", ")}
                        </span>
                      )}
                    </div>
                    {todayAvailability.available && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Today: {todayAvailability.time}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    {todayAvailability.available ? (
                      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20">
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        Unavailable
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CaregiverAvailability;