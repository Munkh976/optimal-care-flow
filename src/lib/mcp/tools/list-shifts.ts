import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_shifts",
  title: "List shifts",
  description: "List care shifts visible to the signed-in user, optionally filtered by date range and status.",
  inputSchema: {
    from_date: z.string().optional().describe("Earliest shift date, YYYY-MM-DD."),
    to_date: z.string().optional().describe("Latest shift date, YYYY-MM-DD."),
    status: z.string().optional().describe("Shift status filter, e.g. open, assigned, completed."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("shifts")
      .select("id, shift_date, start_time, end_time, duration_hours, status, care_type_code, order_title, client_id, caregiver_id, pay_rate")
      .order("shift_date", { ascending: true })
      .limit(Math.min(limit ?? 50, 200));
    if (from_date) query = query.gte("shift_date", from_date);
    if (to_date) query = query.lte("shift_date", to_date);
    if (status) query = query.eq("status", status as never);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ shifts: data });
  },
});
