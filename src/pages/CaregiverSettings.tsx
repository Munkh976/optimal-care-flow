import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CaregiverProfileSettings } from "@/components/caregivers/CaregiverProfileSettings";
import { toast } from "sonner";

const CaregiverSettings = () => {
  const navigate = useNavigate();
  const [caregiverProfile, setCaregiverProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCaregiverProfile();
  }, []);

  const fetchCaregiverProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: caregiver, error } = await supabase
        .from("caregivers")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setCaregiverProfile(caregiver);
    } catch (error: any) {
      toast.error("Failed to load profile");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/caregiver-dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-1">
                Manage your profile and availability
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <CaregiverProfileSettings 
          caregiverProfile={caregiverProfile}
          onRefresh={fetchCaregiverProfile}
        />
      </div>
    </div>
  );
};

export default CaregiverSettings;