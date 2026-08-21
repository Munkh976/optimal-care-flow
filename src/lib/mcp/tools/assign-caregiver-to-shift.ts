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
    const client = supabaseForUser(ctx);

    // shift_assignments is the source of truth; shifts.caregiver_id/status follow via trigger.
    const { data: existing, error: existingError } = await client
      .from("shift_assignments")
      .select("id")
      .eq("shift_id", shift_id)
      .neq("status", "completed" as never)
      .limit(1);
    if (existingError) return errorResult(existingError.message);

    const mutation = existing?.length
      ? client
          .from("shift_assignments")
          .update({ caregiver_id, status: "scheduled" as never })
          .eq("id", existing[0].id)
      : client
          .from("shift_assignments")
          .insert({ shift_id, caregiver_id, status: "scheduled" as never, assignment_method: "manual" as never });

    const { error: assignError } = await mutation;
    if (assignError) return errorResult(assignError.message);

    const { data, error } = await client
      .from("shifts")
      .select("id, shift_date, start_time, end_time, status, caregiver_id")
      .eq("id", shift_id);
    if (error) return errorResult(error.message);
    if (!data?.length) return errorResult("Shift not found or you do not have permission to update it.");
    return textResult({ shift: data[0] });
  },
});

