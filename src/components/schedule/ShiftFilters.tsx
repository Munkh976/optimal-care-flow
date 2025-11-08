import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ShiftFiltersProps {
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (value: string) => void;
  caregiverFilter?: string;
  onCaregiverFilterChange?: (value: string) => void;
  caregivers?: any[];
}

export const ShiftFilters = ({
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  caregiverFilter,
  onCaregiverFilterChange,
  caregivers
}: ShiftFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-4">
      {onStatusFilterChange && (
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {onCategoryFilterChange && (
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm font-medium">Care Type</Label>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="ADL">Activities of Daily Living</SelectItem>
              <SelectItem value="IADL">Instrumental Activities</SelectItem>
              <SelectItem value="Health">Health Monitoring</SelectItem>
              <SelectItem value="Cognitive">Cognitive Support</SelectItem>
              <SelectItem value="Safety">Safety & Transportation</SelectItem>
              <SelectItem value="Specialized">Specialized Care</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {onCaregiverFilterChange && caregivers && (
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm font-medium">Caregiver</Label>
          <Select value={caregiverFilter} onValueChange={onCaregiverFilterChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All caregivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Caregivers</SelectItem>
              {caregivers.map((cg) => (
                <SelectItem key={cg.id} value={cg.id}>
                  {cg.first_name} {cg.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
