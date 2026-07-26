import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in user's id, email and role in CareMuch.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("get_user_role", { _user_id: ctx.getUserId() });
    if (error) return errorResult(error.message);
    return textResult({ user_id: ctx.getUserId(), email: ctx.getUserEmail(), role: data });
  },
});
