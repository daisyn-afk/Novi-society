import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityManager() {
  const qc = useQueryClient();
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["my-availability"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.ProviderAvailability.filter({ provider_id: me.id });
    },
  });

  const addSlot = useMutation({
    mutationFn: async () => {
      await base44.entities.ProviderAvailability.create({
        provider_id: user.id,
        provider_email: user.email,
        ...newSlot,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["my-availability"]);
      setNewSlot({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });
    },
  });

  const deleteSlot = useMutation({
    mutationFn: (id) => base44.entities.ProviderAvailability.delete(id),
    onSuccess: () => qc.invalidateQueries(["my-availability"]),
  });

  const toggleSlot = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.ProviderAvailability.update(id, { is_active: !isActive }),
    onSuccess: () => qc.invalidateQueries(["my-availability"]),
  });

  const groupedByDay = DAYS.map((day, idx) => ({
    day,
    dayIndex: idx,
    slots: availability.filter(a => a.day_of_week === idx),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Weekly Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {groupedByDay.map(({ day, dayIndex, slots }) => (
            <div key={dayIndex} className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-sm text-slate-700 mb-2">{day}</p>
              {slots.length === 0 ? (
                <p className="text-xs text-slate-400">No availability set</p>
              ) : (
                <div className="space-y-2">
                  {slots.map(slot => (
                    <div key={slot.id} className="flex items-center gap-2 text-sm">
                      <Badge variant={slot.is_active ? "default" : "outline"} className="font-mono text-xs">
                        {slot.start_time} - {slot.end_time}
                      </Badge>
                      <Switch
                        checked={slot.is_active}
                        onCheckedChange={() => toggleSlot.mutate({ id: slot.id, isActive: slot.is_active })}
                      />
                      <Button variant="ghost" size="sm" onClick={() => deleteSlot.mutate(slot.id)} className="ml-auto">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <p className="font-semibold text-sm mb-3">Add Time Slot</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Day</Label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={newSlot.day_of_week}
                onChange={e => setNewSlot({...newSlot, day_of_week: parseInt(e.target.value)})}
              >
                {DAYS.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot, start_time: e.target.value})} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newSlot.end_time} onChange={e => setNewSlot({...newSlot, end_time: e.target.value})} />
            </div>
          </div>
          <Button onClick={() => addSlot.mutate()} disabled={addSlot.isPending} className="mt-3 gap-2" style={{ background: "#FA6F30", color: "#fff" }}>
            <Plus className="w-4 h-4" /> Add Slot
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}