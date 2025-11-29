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

interface ParentFiltersProps {
  filters: {
    childrenCount: string[];
    notificationPreference: string[];
  };
  onFiltersChange: (filters: any) => void;
}

export function ParentFilters({ filters, onFiltersChange }: ParentFiltersProps) {
  const hasActiveFilters = 
    filters.childrenCount.length > 0 || 
    filters.notificationPreference.length > 0;

  const clearFilters = () => {
    onFiltersChange({
      childrenCount: [],
      notificationPreference: [],
    });
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    const currentValues = filters[category];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    onFiltersChange({
      ...filters,
      [category]: newValues,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {hasActiveFilters && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {filters.childrenCount.length + filters.notificationPreference.length}
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

          {/* Children Count */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Number of Children</Label>
            <div className="space-y-2">
              {['0', '1', '2', '3+'].map((count) => (
                <div key={count} className="flex items-center space-x-2">
                  <Checkbox
                    id={`children-${count}`}
                    checked={filters.childrenCount.includes(count)}
                    onCheckedChange={() => toggleFilter('childrenCount', count)}
                  />
                  <label
                    htmlFor={`children-${count}`}
                    className="text-sm cursor-pointer"
                  >
                    {count === '0' ? 'No children' : count === '1' ? '1 child' : count === '2' ? '2 children' : '3 or more children'}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Notification Preference */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Notification Preference</Label>
            <div className="space-y-2">
              {['email', 'sms', 'both'].map((pref) => (
                <div key={pref} className="flex items-center space-x-2">
                  <Checkbox
                    id={`notif-${pref}`}
                    checked={filters.notificationPreference.includes(pref)}
                    onCheckedChange={() => toggleFilter('notificationPreference', pref)}
                  />
                  <label htmlFor={`notif-${pref}`} className="text-sm cursor-pointer capitalize">
                    {pref}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}