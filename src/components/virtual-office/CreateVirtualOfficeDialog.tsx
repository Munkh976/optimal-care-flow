import { useState } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  onCreated: () => void;
}

export const CreateVirtualOfficeDialog = ({ open, onOpenChange, agencyId, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Office name is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("virtual_office").insert({
        agency_id: agencyId,
        name: name.trim(),
        code: code.trim() || null,
        is_primary: false,
        is_active: true,
        is_demo: false,
      });
      if (error) throw error;
      toast.success("Virtual office created");
      setName("");
      setCode("");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(
        e?.code === "23505"
          ? "An office with that name already exists in your agency"
          : "Failed to create virtual office"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Virtual Office</DialogTitle>
          <DialogDescription>
            An operating sub-unit of your agency with its own branding, service area and hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vo_name">Office Name *</Label>
            <Input
              id="vo_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Michigan Office"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vo_code">Code</Label>
            <Input
              id="vo_code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., VO-MI"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Office"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
