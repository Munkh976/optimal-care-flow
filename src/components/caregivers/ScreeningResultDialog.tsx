import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Loader2 } from "lucide-react";
import { BAND_LABELS, ScoreBand } from "@/lib/flowEngine";

export interface ScreeningSession {
  id: string;
  registration_id: string | null;
  status: string;
  total_score: number;
  band: string | null;
  trait_scores: Record<string, number> | null;
  completed_at: string | null;
  started_at: string;
}

interface TranscriptRow {
  prompt: string;
  answer: string;
  freeText: string | null;
  skipped: boolean;
  scoreDelta: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ScreeningSession | null;
  applicantName: string;
  applicantEmail: string;
}

export function ScreeningResultDialog({
  open,
  onOpenChange,
  session,
  applicantName,
  applicantEmail,
}: Props) {
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: answers } = await supabase
        .from("conversation_answers")
        .select("node_id, option_labels, free_text, skipped, score_delta, sequence_index, is_active")
        .eq("session_id", session.id)
        .eq("is_active", true)
        .order("sequence_index");

      const nodeIds = Array.from(new Set((answers || []).map((a: any) => a.node_id)));
      const { data: nodes } = nodeIds.length
        ? await supabase.from("flow_nodes").select("id, prompt").in("id", nodeIds)
        : { data: [] as any[] };

      const promptById = new Map((nodes || []).map((n: any) => [n.id, n.prompt]));
      if (cancelled) return;
      setRows(
        (answers || []).map((a: any) => ({
          prompt: promptById.get(a.node_id) || "Question",
          answer: a.skipped ? "Skipped" : (a.option_labels || []).join(", ") || "—",
          freeText: a.free_text,
          skipped: a.skipped,
          scoreDelta: Number(a.score_delta ?? 0),
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session]);

  const exportPdf = () => {
    if (!session) return;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;

    const line = (text: string, size = 11, bold = false, gap = 6) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const chunks = doc.splitTextToSize(text, width);
      chunks.forEach((chunk: string) => {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(chunk, margin, y);
        y += size + 2;
      });
      y += gap;
    };

    line("CareMuch — Caregiver Screening Result", 16, true, 10);
    line(`Applicant: ${applicantName}`, 11, true, 2);
    line(`Email: ${applicantEmail}`, 11, false, 2);
    line(
      `Completed: ${
        session.completed_at ? new Date(session.completed_at).toLocaleString() : "In progress"
      }`,
      11,
      false,
      2
    );
    line(
      `Score: ${session.total_score} — ${
        session.band ? BAND_LABELS[session.band as ScoreBand] ?? session.band : "Not scored"
      }`,
      11,
      true,
      10
    );

    const traits = session.trait_scores || {};
    if (Object.keys(traits).length) {
      line("Personality profile (0-10)", 13, true, 4);
      Object.entries(traits).forEach(([trait, value]) => {
        line(`• ${TRAIT_LABELS[trait] ?? trait.replace(/_/g, " ")}: ${value} / 10`, 11, false, 0);
      });
      y += 8;
    }

    line("Transcript", 13, true, 6);
    rows.forEach((row, i) => {
      line(`${i + 1}. ${row.prompt}`, 11, true, 2);
      line(`Answer: ${row.answer}`, 11, false, row.freeText ? 2 : 8);
      if (row.freeText) line(`Notes: ${row.freeText}`, 11, false, 8);
    });

    doc.save(`screening-${applicantName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const traits = session?.trait_scores || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Screening result — {applicantName}</DialogTitle>
          <DialogDescription>
            Answers recorded by the CareMuch assistant. Advisory only — approval stays with you.
          </DialogDescription>
        </DialogHeader>

        {session && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <Badge variant={session.band === "strong_fit" ? "default" : "secondary"}>
              {session.band ? BAND_LABELS[session.band as ScoreBand] ?? session.band : "Not scored"}
            </Badge>
            <span className="text-muted-foreground">Total score: {session.total_score}</span>
            {Object.entries(traits).map(([trait, value]) => (
              <span key={trait} className="text-muted-foreground">
                {TRAIT_LABELS[trait] ?? trait.replace(/_/g, " ")}: {value}/10
              </span>
            ))}
          </div>
        )}

        <ScrollArea className="max-h-[45vh] pr-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading transcript...
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No answers were recorded for this session.
            </p>
          ) : (
            <ol className="space-y-4">
              {rows.map((row, i) => (
                <li key={i} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    {i + 1}. {row.prompt}
                  </p>
                  <p className={`mt-1 text-sm ${row.skipped ? "text-muted-foreground italic" : ""}`}>
                    {row.answer}
                  </p>
                  {row.freeText && (
                    <p className="mt-1 text-sm text-muted-foreground">“{row.freeText}”</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={exportPdf} disabled={loading || !session}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
