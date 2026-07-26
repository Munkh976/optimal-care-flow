import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listShifts from "./tools/list-shifts";
import listCaregivers from "./tools/list-caregivers";
import listClients from "./tools/list-clients";
import listTimeOffRequests from "./tools/list-time-off-requests";
import assignCaregiverToShift from "./tools/assign-caregiver-to-shift";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "caremuch-mcp",
  title: "CareMuch MCP",
  version: "0.1.0",
  instructions:
    "Tools for CareMuch, a home-care scheduling app. Read shifts, caregivers, clients and time off requests, and assign caregivers to shifts. All calls act as the signed-in CareMuch user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listShifts, listCaregivers, listClients, listTimeOffRequests, assignCaregiverToShift],
});
