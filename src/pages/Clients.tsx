import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, Phone, MapPin, Heart, AlertCircle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const Clients = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        .single();

      if (profileData) {
        setProfile(profileData);
        fetchClients(session.user.id);
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

  const fetchClients = async (userId: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", userId)
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Client Management</h2>
            <p className="text-muted-foreground">Manage your client profiles</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {clients.filter(c => c.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Age</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                {clients.filter(c => c.date_of_birth).length > 0
                  ? Math.round(
                      clients
                        .filter(c => c.date_of_birth)
                        .reduce((sum, c) => sum + calculateAge(c.date_of_birth), 0) /
                        clients.filter(c => c.date_of_birth).length
                    )
                  : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {clients.length === 0 ? (
            <Card className="md:col-span-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No clients in your system yet</p>
                <Button className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            clients.map((client) => (
              <Card key={client.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl mb-2">
                        {client.first_name} {client.last_name}
                      </CardTitle>
                      {client.date_of_birth && (
                        <p className="text-sm text-muted-foreground">
                          Age {calculateAge(client.date_of_birth)} • Born {format(new Date(client.date_of_birth), "MMM dd, yyyy")}
                        </p>
                      )}
                    </div>
                    <Badge variant={client.is_active ? "default" : "secondary"}>
                      {client.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{client.address}, {client.city}, {client.state} {client.zip_code}</span>
                    </div>

                    {client.medical_conditions && client.medical_conditions.length > 0 && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-sm font-medium">Medical Conditions</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {client.medical_conditions.map((condition: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-destructive/5 text-destructive border-destructive/20">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {client.care_requirements && client.care_requirements.length > 0 && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Care Requirements</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {client.care_requirements.map((req: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {req}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {client.emergency_contact_name && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-accent" />
                          <span className="text-sm font-medium">Emergency Contact</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {client.emergency_contact_name} • {client.emergency_contact_phone}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Clients;
