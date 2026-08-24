import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Inbox, Mail, MessageSquare, Phone, UserPlus } from "lucide-react";
import { FlexibilityBadge } from "@/components/common/FlexibilityBadge";
import { ConvertToClientDialog, type ConvertRequest } from "@/components/inquiries/ConvertToClientDialog";

interface InquiryAnswer {
  prompt: string;
  answer: string;
}

interface Inquiry {
  id: string;
  session_id: string | null;
  virtual_office_id: string | null;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
  family_name: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  contact_preference: string | null;
  submitted_at: string | null;
  answers: InquiryAnswer[];
  client_id: string | null;
  converted_client_name: string | null;
  care_type_codes: string[];
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
  location_zip_code: string | null;
  flexibility: string | null;
  time_windows: any[];
}

interface OfficeOption {
  id: string;
  name: string;
}


const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "matched", label: "Matched" },
  { value: "scheduled", label: "Scheduled" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const PREFERENCE_META: Record<string, { label: string; icon: typeof Phone }> = {
  phone: { label: "Phone call", icon: Phone },
  text: { label: "Text message", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
};

const ClientInquiries = () => {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);

    // care_requests is the authoritative inbound list; the conversation session
    // (when present) only supplies the transcript, so nothing is double-counted.
    const { data, error } = await supabase
      .from("care_requests")
      .select(
        "id, session_id, virtual_office_id, status, source, notes, created_at, families(family_name), conversation_sessions(client_name, client_phone, client_email, contact_preference, submitted_at)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const requests = (data as any[]) ?? [];
    const sessionIds = requests.map((r) => r.session_id).filter(Boolean) as string[];

    let answersBySession: Record<string, InquiryAnswer[]> = {};
    if (sessionIds.length > 0) {
      const { data: answerRows } = await supabase
        .from("conversation_answers")
        .select("session_id, option_labels, free_text, skipped, sequence_index, is_active, flow_nodes(prompt)")
        .in("session_id", sessionIds)
        .eq("is_active", true)
        .order("sequence_index");

      answersBySession = ((answerRows as any[]) ?? []).reduce(
        (acc: Record<string, InquiryAnswer[]>, row: any) => {
          const labels: string[] = row.option_labels ?? [];
          const answer = row.skipped
            ? "Skipped"
            : [labels.join(", "), row.free_text].filter(Boolean).join(" — ");
          (acc[row.session_id] ??= []).push({
            prompt: row.flow_nodes?.prompt ?? "Question",
            answer: answer || "—",
          });
          return acc;
        },
        {}
      );
    }

    setRows(
      requests.map((r) => ({
        id: r.id,
        session_id: r.session_id,
        virtual_office_id: r.virtual_office_id,
        status: r.status,
        source: r.source,
        notes: r.notes,
        created_at: r.created_at,
        family_name: r.families?.family_name ?? null,
        client_name: r.conversation_sessions?.client_name ?? r.families?.family_name ?? null,
        client_phone: r.conversation_sessions?.client_phone ?? null,
        client_email: r.conversation_sessions?.client_email ?? null,
        contact_preference: r.conversation_sessions?.contact_preference ?? null,
        submitted_at: r.conversation_sessions?.submitted_at ?? r.created_at,
        answers: r.session_id ? answersBySession[r.session_id] ?? [] : [],
      }))
    );
    setLoading(false);
  };

  const fetchOffices = async () => {
    const { data } = await supabase
      .from("virtual_office")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setOffices((data as OfficeOption[]) ?? []);
  };

  useEffect(() => {
    fetchRows();
    fetchOffices();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("care_requests")
      .update({ status: status as never })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));
    toast.success("Status updated");
  };

  const saveNote = async (id: string) => {
    setSavingNote(id);
    const { error } = await supabase
      .from("care_requests")
      .update({ notes: noteDrafts[id] ?? "" })
      .eq("id", id);
    setSavingNote(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, notes: noteDrafts[id] ?? "" } : row))
    );
    toast.success("Note saved");
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesOffice =
        officeFilter === "all" ||
        (officeFilter === "none" ? !row.virtual_office_id : row.virtual_office_id === officeFilter);
      const matchesSearch =
        !term ||
        [row.client_name, row.client_phone, row.client_email, row.family_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return matchesStatus && matchesOffice && matchesSearch;
    });
  }, [rows, search, statusFilter, officeFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Inquiries</h1>
          <p className="text-sm text-muted-foreground">
            Inbound family care requests from the CareMuch assistant and your public office pages
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or email"
            className="sm:max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {offices.length > 1 && (
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="All offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">No office (assistant)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading inquiries...</p>}

        {!loading && filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No client inquiries yet.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {filtered.map((row) => {
            const preference = PREFERENCE_META[row.contact_preference ?? ""];
            const PreferenceIcon = preference?.icon ?? Phone;
            return (
              <Card key={row.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{row.client_name ?? "Unnamed"}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-3 pt-1">
                      <span>{row.client_phone ?? "No phone"}</span>
                      {row.client_email && <span>{row.client_email}</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <PreferenceIcon className="h-3.5 w-3.5" />
                        {preference?.label ?? "No preference"}
                      </span>
                      <Badge variant="outline">
                        {row.source === "public_site" ? "Public office page" : "Assistant"}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.status === "new" ? "default" : "secondary"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                    <Select value={row.status} onValueChange={(value) => updateStatus(row.id, value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {row.answers.map((answer, index) => (
                      <div key={`${row.id}-${index}`} className="rounded-lg bg-muted/40 p-3">
                        <dt className="text-xs font-medium text-muted-foreground">
                          {answer.prompt}
                        </dt>
                        <dd className="text-sm text-foreground">{answer.answer}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      placeholder="Internal notes for your team"
                      value={noteDrafts[row.id] ?? row.notes ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((drafts) => ({ ...drafts, [row.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        savingNote === row.id ||
                        (noteDrafts[row.id] ?? row.notes ?? "") === (row.notes ?? "")
                      }
                      onClick={() => saveNote(row.id)}
                    >
                      {savingNote === row.id ? "Saving..." : "Save note"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {row.submitted_at
                      ? format(new Date(row.submitted_at), "MMM d, yyyy h:mm a")
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default ClientInquiries;
