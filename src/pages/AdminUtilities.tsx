import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const AdminUtilities = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleBatchCreateUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-create-users`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create users");
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message,
      });

      console.log("Batch create results:", result.results);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Admin Utilities</CardTitle>
            <CardDescription>
              Administrative tools for managing sample data and system operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Batch Create User Accounts</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will create user accounts with default password "123456" for all clients and caregivers 
                that don't have user accounts yet. It will also create their profiles and assign appropriate roles.
              </p>
              <Button 
                onClick={handleBatchCreateUsers} 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User Accounts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUtilities;
