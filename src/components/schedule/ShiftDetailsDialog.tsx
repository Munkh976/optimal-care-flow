import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, Briefcase, FileText, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ShiftDetailsDialogProps {
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShiftDetailsDialog = ({ shift, open, onOpenChange }: ShiftDetailsDialogProps) => {
  const navigate = useNavigate();
  if (!shift) return null;

  const isUnassigned = !shift.shift_assignments || shift.shift_assignments.length === 0;

  const formatCareType = (careType: string) => {
    const types: any = {
      personal_care: "Personal Care",
      companion: "Companion Care",
      medical: "Medical Care",
      respite: "Respite Care",
    };
    return types[careType] || careType;
  };

  const getCareTypeColor = (careType: string) => {
    const colors: any = {
      personal_care: "bg-primary/10 text-primary border-primary/20",
      companion: "bg-accent/10 text-accent border-accent/20",
      medical: "bg-destructive/10 text-destructive border-destructive/20",
      respite: "bg-secondary/10 text-secondary border-secondary/20",
    };
    return colors[careType] || "bg-muted";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {shift.care_type_code} - {shift.care_type?.name || formatCareType(shift.care_type_code)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Client Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
              <User className="h-4 w-4" />
              Client
            </div>
            <div className="ml-6">
              <p className="font-medium text-lg">
                {shift.client?.first_name} {shift.client?.last_name}
              </p>
            </div>
          </div>

          {/* Location */}
          {shift.client?.address && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <div className="ml-6">
                <p className="text-sm">
                  {shift.client.address}
                  {shift.client.city && `, ${shift.client.city}`}
                  {shift.client.state && `, ${shift.client.state}`}
                  {shift.client.zip_code && ` ${shift.client.zip_code}`}
                </p>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                <Calendar className="h-4 w-4" />
                Date
              </div>
              <div className="ml-6">
                <p className="text-sm">{new Date(shift.shift_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                <Clock className="h-4 w-4" />
                Time
              </div>
              <div className="ml-6">
                <p className="text-sm">
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                  <span className="text-muted-foreground ml-2">
                    ({shift.duration_hours} hours)
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Care Requirements / Needs */}
          {shift.client?.care_requirements && shift.client.care_requirements.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                <FileText className="h-4 w-4" />
                Care Needs
              </div>
              <div className="ml-6">
                <div className="flex flex-wrap gap-2">
                  {shift.client.care_requirements.map((req: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {shift.special_instructions && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                <FileText className="h-4 w-4" />
                Special Instructions
              </div>
              <div className="ml-6">
                <p className="text-sm whitespace-pre-wrap">{shift.special_instructions}</p>
              </div>
            </div>
          )}

          {/* Assigned Caregiver */}
          {shift.shift_assignments && shift.shift_assignments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                <User className="h-4 w-4" />
                Assigned Caregiver
              </div>
              <div className="ml-6">
                <p className="font-medium">
                  {shift.shift_assignments[0].caregiver?.first_name}{" "}
                  {shift.shift_assignments[0].caregiver?.last_name}
                </p>
                <Badge variant="outline" className="mt-2">
                  {shift.shift_assignments[0].status}
                </Badge>
              </div>
            </div>
          )}

          {/* Quick Assign Button for Unassigned Shifts */}
          {isUnassigned && (
            <div className="mt-6 pt-6 border-t">
              <Button 
                className="w-full gap-2" 
                onClick={() => {
                  navigate(`/quick-assign?shift=${shift.id}`);
                  onOpenChange(false);
                }}
              >
                <Zap className="h-4 w-4" />
                Quick Assign Caregiver
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
