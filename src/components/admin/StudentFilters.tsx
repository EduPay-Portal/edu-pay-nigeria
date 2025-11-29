import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Filter, X } from "lucide-react";

interface StudentFiltersProps {
  filters: {
    classLevels: string[];
    membershipStatus: string[];
    boardingStatus: string[];
    hasDebt: boolean | null;
  };
  onFiltersChange: (filters: any) => void;
  availableClasses: string[];
}

export function StudentFilters({ filters, onFiltersChange, availableClasses }: StudentFiltersProps) {
  const hasActiveFilters = 
    filters.classLevels.length > 0 || 
    filters.membershipStatus.length > 0 || 
    filters.boardingStatus.length > 0 ||
    filters.hasDebt !== null;

  const clearFilters = () => {
    onFiltersChange({
      classLevels: [],
      membershipStatus: [],
      boardingStatus: [],
      hasDebt: null,
    });
  };

  const toggleFilter = (category: keyof typeof filters, value: any) => {
    if (category === 'hasDebt') {
      onFiltersChange({
        ...filters,
        hasDebt: filters.hasDebt === value ? null : value,
      });
    } else {
      const currentValues = filters[category] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      onFiltersChange({
        ...filters,
        [category]: newValues,
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {hasActiveFilters && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {filters.classLevels.length + filters.membershipStatus.length + filters.boardingStatus.length + (filters.hasDebt !== null ? 1 : 0)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filters</h4>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <Separator />

          {/* Class Level */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Class Level</Label>
            <div className="space-y-2">
              {availableClasses.map((classLevel) => (
                <div key={classLevel} className="flex items-center space-x-2">
                  <Checkbox
                    id={`class-${classLevel}`}
                    checked={filters.classLevels.includes(classLevel)}
                    onCheckedChange={() => toggleFilter('classLevels', classLevel)}
                  />
                  <label
                    htmlFor={`class-${classLevel}`}
                    className="text-sm cursor-pointer"
                  >
                    {classLevel}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Membership Status */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Membership</Label>
            <div className="space-y-2">
              {['MEMBER', 'NON-MEMBER'].map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`member-${status}`}
                    checked={filters.membershipStatus.includes(status)}
                    onCheckedChange={() => toggleFilter('membershipStatus', status)}
                  />
                  <label htmlFor={`member-${status}`} className="text-sm cursor-pointer">
                    {status === 'MEMBER' ? 'Member' : 'Non-Member'}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Boarding Status */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Boarding</Label>
            <div className="space-y-2">
              {['BOARDER', 'DAY'].map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`boarding-${status}`}
                    checked={filters.boardingStatus.includes(status)}
                    onCheckedChange={() => toggleFilter('boardingStatus', status)}
                  />
                  <label htmlFor={`boarding-${status}`} className="text-sm cursor-pointer">
                    {status === 'BOARDER' ? 'Boarder' : 'Day Student'}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Debt Status */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Debt Status</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-debt"
                  checked={filters.hasDebt === true}
                  onCheckedChange={() => toggleFilter('hasDebt', true)}
                />
                <label htmlFor="has-debt" className="text-sm cursor-pointer">
                  Has Debt
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-debt"
                  checked={filters.hasDebt === false}
                  onCheckedChange={() => toggleFilter('hasDebt', false)}
                />
                <label htmlFor="no-debt" className="text-sm cursor-pointer">
                  No Debt
                </label>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}