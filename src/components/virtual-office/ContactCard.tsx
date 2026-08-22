import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { US_STATES } from "@/constants/usStates";

export interface ContactValues {
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  timezone: string;
}

interface Props {
  value: ContactValues;
  onChange: (next: ContactValues) => void;
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export const ContactCard = ({ value, onChange }: Props) => {
  const set = (k: keyof ContactValues, v: string) => onChange({ ...value, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact & Location</CardTitle>
        <CardDescription>Local contact details for this office</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vo_email">Contact Email</Label>
            <Input
              id="vo_email"
              type="email"
              value={value.contact_email || ""}
              onChange={(e) => set("contact_email", e.target.value)}
              placeholder="office@agency.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vo_phone">Contact Phone</Label>
            <Input
              id="vo_phone"
              value={value.contact_phone || ""}
              onChange={(e) => set("contact_phone", e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vo_address">Street Address</Label>
          <Input
            id="vo_address"
            value={value.address || ""}
            onChange={(e) => set("address", e.target.value)}
            placeholder="123 Main Street"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vo_city">City</Label>
            <Input
              id="vo_city"
              value={value.city || ""}
              onChange={(e) => set("city", e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vo_state">State</Label>
            <Select value={value.state || ""} onValueChange={(v) => set("state", v)}>
              <SelectTrigger id="vo_state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vo_zip">ZIP Code</Label>
            <Input
              id="vo_zip"
              value={value.zip_code || ""}
              onChange={(e) => set("zip_code", e.target.value)}
              placeholder="12345"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vo_tz">Timezone</Label>
          <Select value={value.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger id="vo_tz">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
