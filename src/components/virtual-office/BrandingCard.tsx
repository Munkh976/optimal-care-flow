import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Branding } from "./types";

interface Props {
  value: Branding;
  onChange: (next: Branding) => void;
}

export const BrandingCard = ({ value, onChange }: Props) => {
  const set = (k: keyof Branding, v: string) => onChange({ ...value, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>How this office presents itself to families and caregivers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={value.display_name || ""}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder="CareMuch Michigan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={value.tagline || ""}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Compassionate care, close to home"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo_url">Logo URL</Label>
          <Input
            id="logo_url"
            value={value.logo_url || ""}
            onChange={(e) => set("logo_url", e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Primary Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="primary_color"
                value={value.primary_color || ""}
                onChange={(e) => set("primary_color", e.target.value)}
                placeholder="#0D9488"
              />
              <span
                className="h-9 w-9 shrink-0 rounded-md border"
                style={{ backgroundColor: value.primary_color || "transparent" }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary_color">Secondary Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="secondary_color"
                value={value.secondary_color || ""}
                onChange={(e) => set("secondary_color", e.target.value)}
                placeholder="#0F172A"
              />
              <span
                className="h-9 w-9 shrink-0 rounded-md border"
                style={{ backgroundColor: value.secondary_color || "transparent" }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
