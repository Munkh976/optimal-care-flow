import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const usePendingApprovals = () => {
  const [count, setCount] = useState(0);

  const refresh = async () => {
    const { count: pending } = await supabase
      .from("caregiver_registrations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setCount(pending ?? 0);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { pendingCount: count, refreshPendingCount: refresh };
};
