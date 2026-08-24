import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_caregivers",
  title: "List caregivers",
  description: "List caregivers visible to the signed-in user, optionally filtered by name or city.",
  inputSchema: {
    search: z.string().optional().describe("Match against caregiver first or last name."),
    city: z.string().optional().describe("Filter by caregiver city."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, city, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("caregivers")
      .select("id, first_name, last_name, email, phone, role, city, state, skills, certifications, reliability_score, hourly_rate, is_active")
      .limit(Math.min(limit ?? 50, 200));
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    if (city) query = query.ilike("city", city);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ caregivers: data });
  },
});
