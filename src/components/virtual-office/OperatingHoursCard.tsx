import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAY_LABELS, OperatingHours } from "./types";

interface Props {
  value: OperatingHours;
  onChange: (next: OperatingHours) => void;
}

export const OperatingHoursCard = ({ value, onChange }: Props) => {
  const set = (day: string, patch: Partial<OperatingHours[string]>) =>
    onChange({ ...value, [day]: { ...value[day], ...patch } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating Hours</CardTitle>
        <CardDescription>Office hours for this location</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {DAY_LABELS.map((label, i) => {
          const key = String(i);
          const day = value[key];
          return (
            <div key={key} className="grid grid-cols-1 md:grid-cols-[140px_auto_1fr_1fr] items-center gap-3">
              <Label className="font-medium">{label}</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id={`open_${key}`}
                  checked={!day.closed}
                  onCheckedChange={(c) => set(key, { closed: !c })}
                />
                <span className="text-sm text-muted-foreground">{day.closed ? "Closed" : "Open"}</span>
              </div>
              <Input
                type="time"
                value={day.start}
                disabled={day.closed}
                onChange={(e) => set(key, { start: e.target.value })}
              />
              <Input
                type="time"
                value={day.end}
                disabled={day.closed}
                onChange={(e) => set(key, { end: e.target.value })}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
