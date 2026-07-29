import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Inbox, Mail, MessageSquare, Phone } from "lucide-react";

interface InquiryAnswer {
  prompt: string;
  answer: string;
}

interface Inquiry {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  contact_preference: string | null;
  follow_up_status: string;
  submitted_at: string | null;
  created_at: string;
  answers: InquiryAnswer[];
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  consultation_scheduled: "Consultation scheduled",
};

const PREFERENCE_META: Record<string, { label: string; icon: typeof Phone }> = {
  phone: { label: "Phone call", icon: Phone },
  text: { label: "Text message", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
};

const ClientInquiries = () => {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("conversation_sessions")
      .select(
        "id, client_name, client_phone, client_email, contact_preference, follow_up_status, submitted_at, created_at, conversation_flows!inner(audience)"
      )
      .eq("conversation_flows.audience", "family_intake")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const sessions = (data as any[]) ?? [];
    const ids = sessions.map((s) => s.id);

    let answersBySession: Record<string, InquiryAnswer[]> = {};
    if (ids.length > 0) {
      const { data: answerRows } = await supabase
        .from("conversation_answers")
        .select("session_id, option_labels, free_text, skipped, sequence_index, is_active, flow_nodes(prompt)")
        .in("session_id", ids)
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
      sessions.map((s) => ({
        ...s,
        answers: answersBySession[s.id] ?? [],
      })) as Inquiry[]
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("conversation_sessions")
      .update({ follow_up_status: status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, follow_up_status: status } : row))
    );
    toast.success("Status updated");
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.follow_up_status === statusFilter;
      const matchesSearch =
        !term ||
        [row.client_name, row.client_phone, row.client_email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Inquiries</h1>
          <p className="text-sm text-muted-foreground">
            Family care requests submitted through the CareMuch assistant
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
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="consultation_scheduled">Consultation scheduled</SelectItem>
            </SelectContent>
          </Select>
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
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.follow_up_status === "new" ? "default" : "secondary"}>
                      {STATUS_LABELS[row.follow_up_status] ?? row.follow_up_status}
                    </Badge>
                    <Select
                      value={row.follow_up_status}
                      onValueChange={(value) => updateStatus(row.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="consultation_scheduled">
                          Consultation scheduled
                        </SelectItem>
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