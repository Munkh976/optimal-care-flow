import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "assign_caregiver_to_shift",
  title: "Assign caregiver to shift",
  description: "Assign a caregiver to an existing shift and mark the shift as assigned.",
  inputSchema: {
    shift_id: z.string().describe("The shift id (uuid)."),
    caregiver_id: z.string().describe("The caregiver id (uuid) to assign."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ shift_id, caregiver_id }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("shifts")
      .update({ caregiver_id, status: "assigned" as never })
      .eq("id", shift_id)
      .select("id, shift_date, start_time, end_time, status, caregiver_id");
    if (error) return errorResult(error.message);
    if (!data?.length) return errorResult("Shift not found or you do not have permission to update it.");
    return textResult({ shift: data[0] });
  },
});
