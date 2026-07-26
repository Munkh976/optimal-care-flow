import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description: "List care clients visible to the signed-in user, optionally filtered by name.",
  inputSchema: {
    search: z.string().optional().describe("Match against client first or last name."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("clients")
      .select("id, first_name, last_name, email, phone, city, state, zip_code, care_requirements, medical_conditions")
      .limit(Math.min(limit ?? 50, 200));
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ clients: data });
  },
});
