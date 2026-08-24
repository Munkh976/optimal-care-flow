import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlexibilityBadge } from "@/components/common/FlexibilityBadge";

export interface ConvertRequest {
  id: string;
  agency_id?: string | null;
  client_id: string | null;
  family_name: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  care_type_codes: string[];
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
  location_zip_code: string | null;
  flexibility: string | null;
  time_windows?: {
    day_of_week: number;
    preferred_start: string | null;
    preferred_end: string | null;
    flexibility: string | null;
  }[];
}

interface Props {
  request: ConvertRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (clientId: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const splitName = (full: string | null) => {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
};

export const ConvertToClientDialog = ({ request, open, onOpenChange, onConverted }: Props) => {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingClientId, setExistingClientId] = useState<string>("");
  const [clients, setClients] = useState<{ id: string; first_name: string; last_name: string; city: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    if (!open || !request) return;
    const { first, last } = splitName(request.client_name ?? request.family_name);
    setMode("new");
    setExistingClientId("");
    setForm({
      first_name: first,
      last_name: last,
      phone: request.client_phone ?? "",
      email: request.client_email ?? "",
      address: request.location_address ?? "",
      city: request.location_city ?? "",
      state: request.location_state ?? "",
      zip_code: request.location_zip_code ?? "",
    });

    supabase
      .from("clients")
      .select("id, first_name, last_name, city")
      .eq("is_active", true)
      .order("first_name")
      .then(({ data }) => setClients((data as any[]) ?? []));
  }, [open, request]);

  const windows = useMemo(() => request?.time_windows ?? [], [request]);

  const handleConvert = async () => {
    if (!request) return;
    if (mode === "new" && (!form.first_name.trim() || !form.phone.trim())) {
      toast.error("First name and phone are required");
      return;
    }
    if (mode === "existing" && !existingClientId) {
      toast.error("Select a client to link");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("convert_care_request_to_client", {
      p_request_id: request.id,
      p_existing_client_id: mode === "existing" ? existingClientId : null,
      p_first_name: form.first_name,
      p_last_name: form.last_name,
      p_phone: form.phone,
      p_email: form.email,
      p_address: form.address,
      p_city: form.city,
      p_state: form.state,
      p_zip_code: form.zip_code,
      p_care_type_codes: request.care_type_codes ?? [],
      p_family_name: request.family_name,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as any;
    if (result?.already_converted) {
      toast.info("This request was already converted");
    } else {
      toast.success(result?.created ? "Client created and linked" : "Request linked to existing client");
    }
    onConverted(result?.client_id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert inquiry to client</DialogTitle>
          <DialogDescription>
            Creates (or links) a client record and marks this request as matched. Build the care plan
            afterwards from Care Plans.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <FlexibilityBadge value={request?.flexibility} />
          {(request?.care_type_codes ?? []).map((code) => (
            <Badge key={code} variant="outline">
              {code}
            </Badge>
          ))}
        </div>

        {windows.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="mb-1 font-medium">Requested time windows</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {windows.map((w, i) => (
                <li key={i}>
                  {DAYS[w.day_of_week] ?? w.day_of_week}: {w.preferred_start?.slice(0, 5) ?? "—"} –{" "}
                  {w.preferred_end?.slice(0, 5) ?? "—"}
                  {w.flexibility ? ` (${w.flexibility})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label>Conversion mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "new" | "existing")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Create a new client</SelectItem>
              <SelectItem value="existing">Link to an existing client</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <Label>Existing client</Label>
            <Select value={existingClientId} onValueChange={setExistingClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.city ? ` — ${c.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The client keeps its own family link; nothing on the existing record is overwritten.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name *</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP code</Label>
              <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={saving}>
            {saving ? "Converting..." : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
