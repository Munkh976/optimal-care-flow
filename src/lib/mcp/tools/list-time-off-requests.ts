import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_time_off_requests",
  title: "List time off requests",
  description: "List caregiver time off requests visible to the signed-in user, optionally filtered by status.",
  inputSchema: {
    status: z.string().optional().describe("Request status filter, e.g. pending, approved, denied."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    let query = supabaseForUser(ctx)
      .from("time_off_requests")
      .select("id, caregiver_id, request_type, status, start_date, end_date, reason, notes, created_at")
      .order("start_date", { ascending: false })
      .limit(Math.min(limit ?? 50, 200));
    if (status) query = query.eq("status", status as never);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ requests: data });
  },
});
