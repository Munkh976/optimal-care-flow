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

    // Eligibility + tenancy are enforced in the database.
    const { error: assignError } = await client.rpc("assign_caregiver_to_shift" as never, {
      _shift_id: shift_id,
      _caregiver_id: caregiver_id,
      _method: "manual",
      _notes: null,
      _override_reason: null,
    } as never);
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

