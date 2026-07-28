import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CareService {
  code: string;
  name: string;
  category: string;
  description?: string | null;
  price?: number | null;
  duration_hours?: number | null;
}

export interface CareServiceCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface CareServiceGroup {
  label: string;
  options: { value: string; label: string; category: string }[];
}

/**
 * Single source of truth for the Care Services catalog and its categories.
 * Categories always come from `care_service_categories` (the list managed on the
 * Care Services page) so every picker in the app shows the same names in the
 * same order.
 */
export function useCareServices() {
  const servicesQuery = useQuery({
    queryKey: ["care-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_types")
        .select("code, name, category, description, price, duration_hours")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as CareService[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["care-service-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_service_categories" as never)
        .select("id, name, sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CareServiceCategory[];
    },
  });

  const services = servicesQuery.data || [];
  const categories = categoriesQuery.data || [];

  const order = new Map(categories.map((c, i) => [c.name, c.sort_order ?? i]));
  const usedCategories = Array.from(new Set(services.map((s) => s.category).filter(Boolean)));
  // Managed categories first (in their configured order), then any leftovers.
  const orderedCategories = [
    ...categories.map((c) => c.name).filter((n) => usedCategories.includes(n)),
    ...usedCategories.filter((n) => !order.has(n)).sort(),
  ];

  const groupedOptions: CareServiceGroup[] = orderedCategories.map((category) => ({
    label: category,
    options: services
      .filter((s) => s.category === category)
      .map((s) => ({ value: s.code, label: `${s.name} · ${s.code}`, category })),
  }));

  const byCode = new Map(services.map((s) => [s.code, s]));

  const optionFor = (code: string) => {
    const s = byCode.get(code);
    return s
      ? { value: s.code, label: `${s.name} · ${s.code}`, category: s.category }
      : { value: code, label: code, category: "" };
  };

  return {
    services,
    categories,
    categoryNames: orderedCategories,
    groupedOptions,
    byCode,
    optionFor,
    isLoading: servicesQuery.isLoading || categoriesQuery.isLoading,
  };
}