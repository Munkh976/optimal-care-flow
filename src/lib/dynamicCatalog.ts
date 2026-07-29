/**
 * Dynamic question sources.
 *
 * Some conversation questions do not have fixed answers: their options are the
 * live rows of a catalog table the agency already manages (care service
 * categories, care services, certifications). This module is the only place
 * that knows which tables can drive a question and how their rows are scored.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DynamicItem {
  id: string;
  name: string;
  sort_order: number;
  weight_overrides: Record<string, number> | null;
  category_id?: string | null;
}

export const DYNAMIC_SOURCES: Record<string, { label: string; supportsSubQuestions: boolean }> = {
  care_service_categories: { label: "care_service_categories", supportsSubQuestions: true },
  care_types: { label: "care_types", supportsSubQuestions: false },
  certifications: { label: "certifications", supportsSubQuestions: false },
};

export function isDynamicSource(table?: string | null): table is string {
  return Boolean(table && table in DYNAMIC_SOURCES);
}

function toWeights(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
    k,
    Number(v) || 0,
  ]);
  return entries.length ? (Object.fromEntries(entries) as Record<string, number>) : null;
}

/** Active rows of a catalog table, ordered the way managers arranged them. */
export async function fetchDynamicItems(
  table: string,
  options?: { categoryId?: string }
): Promise<DynamicItem[]> {
  if (!isDynamicSource(table)) return [];

  if (table === "care_types") {
    let query = supabase
      .from("care_types")
      .select("id, name, category_id, weight_overrides")
      .eq("is_active", true)
      .order("name");
    if (options?.categoryId) query = query.eq("category_id", options.categoryId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any, index: number) => ({
      id: row.id,
      name: row.name,
      sort_order: index,
      category_id: row.category_id,
      weight_overrides: toWeights(row.weight_overrides),
    }));
  }

  const { data, error } = await supabase
    .from(table as "certifications")
    .select("id, name, sort_order, weight_overrides")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    sort_order: row.sort_order ?? 0,
    weight_overrides: toWeights(row.weight_overrides),
  }));
}

/** Save per-item weight overrides back onto the catalog row. */
export async function saveItemOverrides(
  table: string,
  itemId: string,
  weights: Record<string, number> | null
) {
  const { error } = await supabase
    .from(table as "certifications")
    .update({ weight_overrides: weights as never })
    .eq("id", itemId);
  if (error) throw error;
}

/**
 * Points earned for one picked item: the node defaults merged with the item's
 * own overrides, taking the higher value per trait when both are present.
 */
export function itemWeights(
  defaults: Record<string, number> | null | undefined,
  overrides: Record<string, number> | null | undefined
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const [trait, value] of Object.entries(defaults ?? {})) merged[trait] = Number(value) || 0;
  for (const [trait, value] of Object.entries(overrides ?? {})) {
    const next = Number(value) || 0;
    merged[trait] = Math.max(merged[trait] ?? 0, next);
  }
  return merged;
}

/** Total trait points for a set of picked items. */
export function accumulateWeights(
  defaults: Record<string, number> | null | undefined,
  items: DynamicItem[]
): Record<string, number> {
  const total: Record<string, number> = {};
  for (const item of items) {
    for (const [trait, value] of Object.entries(itemWeights(defaults, item.weight_overrides))) {
      total[trait] = (total[trait] ?? 0) + value;
    }
  }
  return total;
}

/** Fill `{category}` in a sub-question template. */
export function renderSubQuestion(template: string | null | undefined, category: string) {
  const text = template?.trim() || "Which {category} services have you provided?";
  return text.replace(/\{category\}/g, category);
}

/**
 * Care service codes for a set of picked catalog ids. Ids that belong to other
 * catalogs (categories, certifications) are simply ignored.
 */
export async function fetchCareServiceCodes(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("care_types")
    .select("code")
    .in("id", unique);
  if (error) throw error;
  return Array.from(new Set((data || []).map((row: any) => row.code).filter(Boolean)));
}
