import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { US_STATES } from "@/constants/usStates";
import { ServiceArea } from "./types";

interface Props {
  states: string[];
  zipcodes: string[];
  area: ServiceArea;
  onChange: (next: { states: string[]; zipcodes: string[]; area: ServiceArea }) => void;
}

export const ServiceAreaCard = ({ states, zipcodes, area, onChange }: Props) => {
  const [zipInput, setZipInput] = useState("");

  const addState = (v: string) => {
    if (states.includes(v)) return;
    onChange({ states: [...states, v], zipcodes, area });
  };
  const removeState = (v: string) =>
    onChange({ states: states.filter((s) => s !== v), zipcodes, area });

  const addZips = () => {
    const parsed = zipInput
      .split(/[\s,]+/)
      .map((z) => z.trim())
      .filter((z) => z && !zipcodes.includes(z));
    if (parsed.length) onChange({ states, zipcodes: [...zipcodes, ...parsed], area });
    setZipInput("");
  };
  const removeZip = (z: string) =>
    onChange({ states, zipcodes: zipcodes.filter((x) => x !== z), area });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Area</CardTitle>
        <CardDescription>Where this office operates</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>States Served</Label>
          <Select value="" onValueChange={addState}>
            <SelectTrigger>
              <SelectValue placeholder="Add a state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.filter((s) => !states.includes(s.value)).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2 pt-1">
            {states.length === 0 && (
              <span className="text-sm text-muted-foreground">No states added</span>
            )}
            {states.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button type="button" onClick={() => removeState(s)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zips">ZIP Codes Served</Label>
          <div className="flex gap-2">
            <Input
              id="zips"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addZips();
                }
              }}
              placeholder="48104, 48105"
            />
            <Button type="button" variant="outline" onClick={addZips}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {zipcodes.length === 0 && (
              <span className="text-sm text-muted-foreground">No ZIP codes added</span>
            )}
            {zipcodes.map((z) => (
              <Badge key={z} variant="secondary" className="gap-1">
                {z}
                <button type="button" onClick={() => removeZip(z)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="center_zip">Center ZIP</Label>
            <Input
              id="center_zip"
              value={area.center_zip || ""}
              onChange={(e) => onChange({ states, zipcodes, area: { ...area, center_zip: e.target.value } })}
              placeholder="48104"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="radius_miles">Service Radius (miles)</Label>
            <Input
              id="radius_miles"
              type="number"
              min={0}
              value={area.radius_miles ?? ""}
              onChange={(e) =>
                onChange({
                  states,
                  zipcodes,
                  area: { ...area, radius_miles: e.target.value === "" ? null : Number(e.target.value) },
                })
              }
              placeholder="25"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="area_notes">Notes</Label>
          <Textarea
            id="area_notes"
            value={area.notes || ""}
            onChange={(e) => onChange({ states, zipcodes, area: { ...area, notes: e.target.value } })}
            placeholder="Coverage notes for this office"
          />
        </div>
      </CardContent>
    </Card>
  );
};
