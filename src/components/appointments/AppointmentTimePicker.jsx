import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  format12PartsToTime24,
  formatAppointmentTime,
  parseTime24To12Parts,
} from "@/lib/appointmentDisplay";
import { currentTimeInputValue } from "@/lib/repCallScheduling";
import { ChevronDown } from "lucide-react";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function isTimeBeforeMin(time24, minTime24) {
  if (!minTime24 || !time24) return false;
  return time24 < minTime24;
}

function periodOptionClass(selected) {
  return cn(
    "flex h-9 w-full items-center justify-center rounded-md border text-sm transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
  );
}

export function AppointmentTimeField({
  value = "",
  onChange,
  className = "",
  min,
  label = "Time",
}) {
  const [open, setOpen] = useState(false);
  const parts = parseTime24To12Parts(value || "09:00");
  const hour12 = parts.hour12 || "9";
  const minute = parts.minute !== "" ? parts.minute : "00";
  const period = parts.period || "AM";

  const updateTime = (next) => {
    const time24 = format12PartsToTime24({
      hour12: next.hour12 ?? hour12,
      minute: next.minute ?? minute,
      period: next.period ?? period,
    });
    if (time24 && min && isTimeBeforeMin(time24, min)) return;
    onChange(time24);
  };

  const displayLabel = value ? formatAppointmentTime(value) : "Select time";

  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full min-w-0 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "box-border text-left font-normal"
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex items-center gap-2">
            <Select value={hour12} onValueChange={(h) => updateTime({ hour12: h })}>
              <SelectTrigger className="h-9 w-[4.25rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS_12.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">:</span>
            <Select value={minute} onValueChange={(m) => updateTime({ minute: m })}>
              <SelectTrigger className="h-9 w-[4.25rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-1 flex w-[3.25rem] flex-col gap-1">
              {["AM", "PM"].map((nextPeriod) => (
                <button
                  key={nextPeriod}
                  type="button"
                  className={periodOptionClass(period === nextPeriod)}
                  onClick={() => updateTime({ period: nextPeriod })}
                >
                  {nextPeriod}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { currentTimeInputValue };
