import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  isAfter,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  computeHoursDelivered,
  gapOf,
  ratioOf,
  fmtHours,
  UNASSIGNED_OFFICE,
  type CaregiverHours,
  type OfficeTotals,
} from "@/lib/hoursDelivered";

type Preset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

const presetRange = (preset: Preset, custom: { from: Date; to: Date }) => {
  const now = new Date();
  switch (preset) {
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_week": {
      const d = subWeeks(now, 1);
      return { from: startOfWeek(d, { weekStartsOn: 1 }), to: endOfWeek(d, { weekStartsOn: 1 }) };
    }
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": {
      const d = subMonths(now, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    default:
      return custom;
  }
};

const RatioCell = ({ row }: { row: { assignedHours: number; actualHours: number } }) => {
  const ratio = ratioOf(row);
  if (ratio === null) return <span className="text-muted-foreground">—</span>;
  const pct = ratio * 100;
  return (
    <span className={pct >= 95 ? "text-green-600 font-medium" : pct >= 80 ? "font-medium" : "text-destructive font-medium"}>
      {pct.toFixed(0)}%
    </span>
  );
};

const GapCell = ({ row }: { row: CaregiverHours }) => {
  if (row.assignedHours === 0) return <span className="text-muted-foreground">—</span>;
  const gap = gapOf(row);
  if (gap === 0) return <span className="text-muted-foreground">On target</span>;
  return (
    <span className={gap > 0 ? "text-destructive" : "text-amber-600"}>
      {gap > 0 ? "+" : ""}
      {gap.toFixed(1)} h
    </span>
  );
};

export const HoursDeliveredTab = () => {
  const [preset, setPreset] = useState<Preset>("last_week");
  const [custom, setCustom] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [officeFilter, setOfficeFilter] = useState<string>("__all__");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReturnType<typeof computeHoursDelivered> | null>(null);

  const range = useMemo(() => presetRange(preset, custom), [preset, custom]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("agency_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        const agencyId = profile?.agency_id;
        if (!agencyId) {
          if (!cancelled) setData(null);
          return;
        }

        const now = new Date();
        // Retrospective: never look past today.
        const effectiveTo = isAfter(range.to, now) ? now : range.to;
        const from = format(range.from, "yyyy-MM-dd");
        const to = format(effectiveTo, "yyyy-MM-dd");
        // Include the full selected range for shifts so we can report scheduled-ahead hours
        // separately (they are excluded from assigned/gap/ratio).
        const shiftTo = format(range.to, "yyyy-MM-dd");

        const [{ data: shifts, error: shiftsErr }, { data: entries, error: entriesErr }, { data: caregivers }, { data: offices }] =
          await Promise.all([
            supabase
              .from("shifts")
              .select("id, shift_date, end_time, duration_hours, status, shift_assignments ( caregiver_id, status )")
              .eq("agency_id", agencyId)
              .gte("shift_date", from)
              .lte("shift_date", shiftTo),
            supabase
              .from("time_entries")
              .select("caregiver_id, hours_worked, started_at, status, voided_at")
              .eq("agency_id", agencyId)
              .gte("started_at", `${from}T00:00:00`)
              .lte("started_at", `${to}T23:59:59`),
            supabase
              .from("caregivers")
              .select("id, first_name, last_name, virtual_office_id")
              .eq("agency_id", agencyId),
            supabase.from("virtual_office").select("id, name").eq("agency_id", agencyId),
          ]);

        if (shiftsErr) throw shiftsErr;
        if (entriesErr) throw entriesErr;

        const officeNames = new Map((offices || []).map((o: any) => [o.id, o.name]));
        const computed = computeHoursDelivered({
          shifts: (shifts || []) as any,
          timeEntries: (entries || []) as any,
          caregivers: (caregivers || []) as any,
          officeNames,
          now,
        });
        if (!cancelled) setData(computed);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load hours delivered");
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const rows = useMemo(() => {
    if (!data) return [] as CaregiverHours[];
    return officeFilter === "__all__" ? data.rows : data.rows.filter((r) => r.officeId === officeFilter);
  }, [data, officeFilter]);

  const summary: OfficeTotals | null = useMemo(() => {
    if (!data) return null;
    if (officeFilter === "__all__") return data.overall;
    return data.offices.find((o) => o.officeId === officeFilter) || null;
  }, [data, officeFilter]);

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ["Caregiver", "Office", "Assigned hours", "Actual hours", "Gap hours", "Fulfillment %", "State"];
    const lines = rows.map((r) => {
      const ratio = ratioOf(r);
      return [
        `"${r.caregiverName}"`,
        `"${r.officeName}"`,
        r.assignedHours,
        r.actualHours,
        r.assignedHours > 0 ? gapOf(r) : "",
        ratio === null ? "" : (ratio * 100).toFixed(0),
        r.state,
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hours-delivered-${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unassignedActuals = rows.filter((r) => r.state === "unassigned_actuals").length;
  const noActuals = summary && summary.assignedHours > 0 && summary.actualHours === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="last_week">Last week</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_month">Last month</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>

        {preset === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(custom.from, "MMM d")} – {format(custom.to, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: custom.from, to: custom.to }}
                onSelect={(r: any) => r?.from && r?.to && setCustom({ from: r.from, to: r.to })}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={officeFilter} onValueChange={setOfficeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All offices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All offices</SelectItem>
            {(data?.offices || []).map((o) => (
              <SelectItem key={o.officeId} value={o.officeId}>
                {o.officeId === UNASSIGNED_OFFICE ? "Unassigned office" : o.officeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !summary || (!rows.length && summary.assignedHours === 0 && summary.actualHours === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No assigned shifts or actuals in this period.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Assigned hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtHours(summary.assignedHours)}</div>
                <p className="text-xs text-muted-foreground">Occurred, non-cancelled shifts</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Actual hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {noActuals ? <span className="text-base text-muted-foreground">No actuals yet</span> : fmtHours(summary.actualHours)}
                </div>
                <p className="text-xs text-muted-foreground">Approved time entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Gap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.assignedHours > 0 && !noActuals ? (
                    <span className={gapOf(summary) > 0 ? "text-destructive" : "text-amber-600"}>
                      {gapOf(summary) > 0 ? "+" : ""}
                      {gapOf(summary).toFixed(1)} h
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Assigned − actual</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Fulfillment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.anyOccurred ? <RatioCell row={summary} /> : <span className="text-base text-muted-foreground">Not yet worked</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.scheduledAheadHours > 0
                    ? `${fmtHours(summary.scheduledAheadHours)} scheduled ahead (excluded)`
                    : "Actual / assigned"}
                </p>
              </CardContent>
            </Card>
          </div>

          {officeFilter === "__all__" && (data?.offices.length || 0) > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>By virtual office</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Office</TableHead>
                      <TableHead className="text-right">Caregivers</TableHead>
                      <TableHead className="text-right">Assigned</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                      <TableHead className="text-right">Fulfillment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.offices || []).map((o) => (
                      <TableRow key={o.officeId}>
                        <TableCell className="font-medium">{o.officeName}</TableCell>
                        <TableCell className="text-right">{o.caregiverCount}</TableCell>
                        <TableCell className="text-right">{fmtHours(o.assignedHours)}</TableCell>
                        <TableCell className="text-right">
                          {o.actualHours === 0 ? <span className="text-muted-foreground">No actuals yet</span> : fmtHours(o.actualHours)}
                        </TableCell>
                        <TableCell className="text-right">
                          {o.assignedHours > 0 ? `${gapOf(o) > 0 ? "+" : ""}${gapOf(o).toFixed(1)} h` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {o.anyOccurred ? <RatioCell row={o} /> : <span className="text-muted-foreground">Not yet worked</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>By caregiver</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead className="text-right">Fulfillment</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.caregiverId}>
                      <TableCell className="font-medium">{r.caregiverName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.officeName}</TableCell>
                      <TableCell className="text-right">
                        {r.assignedHours > 0 ? fmtHours(r.assignedHours) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.actualHours > 0 ? fmtHours(r.actualHours) : <span className="text-muted-foreground">No actuals yet</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <GapCell row={r} />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.occurredShiftCount > 0 ? (
                          <RatioCell row={r} />
                        ) : (
                          <span className="text-muted-foreground">Not yet worked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.state === "unassigned_actuals" ? (
                          <Badge variant="destructive">Unassigned actuals</Badge>
                        ) : r.state === "not_yet_worked" ? (
                          <Badge variant="outline">
                            Not yet worked{r.scheduledAheadHours > 0 ? ` · ${fmtHours(r.scheduledAheadHours)} ahead` : ""}
                          </Badge>
                        ) : r.state === "no_actuals" ? (
                          <Badge variant="secondary">No actuals yet</Badge>
                        ) : (
                          <Badge variant="secondary">Measured</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Hours only — no pay rates or earnings. Assigned counts non-cancelled shifts that have already
                occurred; future shifts in the range are reported as scheduled ahead and excluded from gap and
                fulfillment.
                {unassignedActuals > 0 && ` ${unassignedActuals} caregiver(s) logged actual hours with no assigned shift in this period.`}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default HoursDeliveredTab;
