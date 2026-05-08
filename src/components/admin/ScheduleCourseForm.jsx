import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { adminLocationsApi } from "@/api/adminLocationsApi";
import { normalizeScheduledSessionDatesEntries } from "@/lib/sessionDateSeats";
import { X, Calendar, Plus, ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";

const EMPTY_DATE_DRAFT = { date: "", start_time: "", end_time: "", location: "", label: "", max_seats: "", available_seats: "" };

/** Treat blank number inputs as missing (avoid Number("") === 0). */
function parseSeatField(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) ? n : null;
}

function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hydrateSessions(sessionDates = []) {
  if (!Array.isArray(sessionDates) || sessionDates.length === 0) return [];

  const grouped = [];
  const indexByKey = new Map();

  sessionDates.forEach((dateEntry, idx) => {
    const sessionKey = dateEntry.session_id || dateEntry.session_name || "session-1";
    if (!indexByKey.has(sessionKey)) {
      indexByKey.set(sessionKey, grouped.length);
      grouped.push({
        id: dateEntry.session_id || `session-${grouped.length + 1}`,
        name: dateEntry.session_name || `Session ${grouped.length + 1}`,
        dates: [],
      });
    }
    const groupIdx = indexByKey.get(sessionKey);
    grouped[groupIdx].dates.push({
      ...EMPTY_DATE_DRAFT,
      ...dateEntry,
      _localId: dateEntry._localId || `date-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    });
  });

  return grouped.map((session) => ({
    ...session,
    dates: [...session.dates].sort((a, b) => (a.date || "") > (b.date || "") ? 1 : -1),
  }));
}

function flattenSessions(sessions = []) {
  return sessions.flatMap((session) =>
    (session.dates || []).map(({ _localId, session_id, session_name, ...dateEntry }) => ({
      ...dateEntry,
      session_id: session.id,
      session_name: session.name?.trim() || "Session",
    }))
  );
}

function buildDraftMap(sessions = []) {
  return sessions.reduce((acc, session) => {
    acc[session.id] = { ...EMPTY_DATE_DRAFT };
    return acc;
  }, {});
}

function buildCollapseMap(sessions = [], collapsed = false) {
  return sessions.reduce((acc, session) => {
    acc[session.id] = collapsed;
    return acc;
  }, {});
}

export default function ScheduleCourseForm({
  open,
  onOpenChange,
  form,
  setForm,
  onSave,
  saving,
  editing,
  templates,
  previousSessionDatesForNormalize = null,
}) {
  const qc = useQueryClient();
  const [sessions, setSessions] = useState(() => hydrateSessions(form.session_dates));
  const [newDatesBySession, setNewDatesBySession] = useState(() => buildDraftMap(hydrateSessions(form.session_dates)));
  const [collapsedBySession, setCollapsedBySession] = useState(() => buildCollapseMap(hydrateSessions(form.session_dates)));
  const [locationPickerSessionId, setLocationPickerSessionId] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [showAddLocationFormSessionId, setShowAddLocationFormSessionId] = useState(null);
  const [locationFormError, setLocationFormError] = useState("");
  const [newLocationTargetSessionId, setNewLocationTargetSessionId] = useState(null);
  const [newLocationForm, setNewLocationForm] = useState({
    venue_name: "",
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const saveInFlightRef = useRef(false);
  const lastHydratedSessionDatesJson = useRef(null);
  const [seatErrors, setSeatErrors] = useState("");

  const selectedTemplate = templates.find(t => t.id === form.template_id);
  const { data: locationOptions = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["admin-locations", locationSearch],
    queryFn: () => adminLocationsApi.list(locationSearch),
    enabled: open,
  });

  const createLocationMutation = useMutation({
    mutationFn: (payload) => adminLocationsApi.create(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      if (newLocationTargetSessionId) {
        updateDateDraft(newLocationTargetSessionId, { location: created.display_name });
      }
      setShowAddLocationFormSessionId(null);
      setNewLocationTargetSessionId(null);
      setLocationFormError("");
      setNewLocationForm({
        venue_name: "",
        street_address: "",
        city: "",
        state: "",
        zip_code: "",
      });
      setLocationPickerSessionId(null);
      setLocationSearch("");
    },
    onError: (error) => {
      setLocationFormError(error?.message || "Unable to add location.");
    },
  });

  useEffect(() => {
    if (!open) {
      lastHydratedSessionDatesJson.current = null;
      return;
    }
    const fp = JSON.stringify(form?.session_dates ?? []);
    if (lastHydratedSessionDatesJson.current === fp) return;
    lastHydratedSessionDatesJson.current = fp;
    const hydrated = hydrateSessions(form.session_dates);
    setSessions(hydrated);
    setNewDatesBySession(buildDraftMap(hydrated));
    setCollapsedBySession(buildCollapseMap(hydrated));
    setLocationPickerSessionId(null);
    setLocationSearch("");
    setShowAddLocationFormSessionId(null);
    setNewLocationTargetSessionId(null);
    setLocationFormError("");
    setSeatErrors("");
    saveInFlightRef.current = false;
  }, [open, form.session_dates]);

  useEffect(() => {
    if (!saving) {
      saveInFlightRef.current = false;
    }
  }, [saving]);

  const locationDisplayName = (location) => {
    if (location?.display_name) return location.display_name;
    return [location?.venue_name, [location?.city, location?.state].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" - ");
  };

  const syncSessionsToForm = (nextSessions) => {
    setForm((prev) => ({ ...prev, session_dates: flattenSessions(nextSessions) }));
  };

  const updateSessions = (updater) => {
    setSessions((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      syncSessionsToForm(next);
      return next;
    });
  };

  const handleTemplateSelect = (templateId) => {
    const t = templates.find(x => x.id === templateId);
    setForm(f => ({
      ...f,
      template_id: templateId,
      title: t?.title || f.title,
      price: t?.price || f.price,
      instructor_name: t?.instructor_name || f.instructor_name,
    }));
  };

  const addSession = () => {
    const newSession = {
      id: generateSessionId(),
      name: `Session ${(sessions?.length || 0) + 1}`,
      dates: [],
    };
    updateSessions((prev) => [...prev, newSession]);
    setNewDatesBySession((prev) => ({ ...prev, [newSession.id]: { ...EMPTY_DATE_DRAFT } }));
    setCollapsedBySession((prev) => ({ ...prev, [newSession.id]: false }));
  };

  const removeSession = (sessionId) => {
    updateSessions((prev) => prev.filter((session) => session.id !== sessionId));
    setNewDatesBySession((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setCollapsedBySession((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  };

  const toggleSessionCollapse = (sessionId) => {
    setCollapsedBySession((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const renameSession = (sessionId, name) => {
    updateSessions((prev) =>
      prev.map((session) => (session.id === sessionId ? { ...session, name } : session))
    );
  };

  const updateDateDraft = (sessionId, patch) => {
    setNewDatesBySession((prev) => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] || EMPTY_DATE_DRAFT), ...patch },
    }));
  };

  const addDateToSession = (sessionId) => {
    const newDate = newDatesBySession[sessionId] || EMPTY_DATE_DRAFT;
    if (!newDate.date) return;
    if (!String(newDate.location || "").trim()) {
      setSeatErrors("Location is required. Select a saved location or add a new one.");
      return;
    }
    const maxNum = parseSeatField(newDate.max_seats);
    let availNum = parseSeatField(newDate.available_seats);
    if (maxNum === 0 && availNum == null) availNum = 0;
    if (maxNum == null || maxNum < 0 || availNum == null || availNum < 0) {
      setSeatErrors("Max seats (0 or more) and available seats (0 or more) are both required.");
      return;
    }
    if (availNum > maxNum) {
      setSeatErrors("Available seats cannot be greater than max seats.");
      return;
    }
    setSeatErrors("");

    updateSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const { max_seats: _dm, available_seats: _da, ...restDraft } = newDate;
        const datePayload = {
          ...restDraft,
          max_seats: maxNum,
          available_seats: availNum,
          _localId: `date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        };
        const dates = [
          ...(session.dates || []),
          datePayload,
        ].sort((a, b) => (a.date || "") > (b.date || "") ? 1 : -1);
        return { ...session, dates };
      })
    );
    updateDateDraft(sessionId, { ...EMPTY_DATE_DRAFT });
  };

  const removeDateFromSession = (sessionId, dateLocalId) => {
    updateSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        return { ...session, dates: (session.dates || []).filter((dateEntry) => dateEntry._localId !== dateLocalId) };
      })
    );
  };

  const updateDateEntryInSession = (sessionId, dateLocalId, patch) => {
    updateSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          dates: (session.dates || []).map((d) => (d._localId === dateLocalId ? { ...d, ...patch } : d)),
        };
      })
    );
  };

  const handleLocationSelect = (sessionId, location) => {
    updateDateDraft(sessionId, { location: locationDisplayName(location) });
    setLocationPickerSessionId(null);
    setLocationFormError("");
  };

  const openAddLocationForm = (sessionId) => {
    setShowAddLocationFormSessionId(sessionId);
    setNewLocationTargetSessionId(sessionId);
    setLocationFormError("");
    setLocationPickerSessionId(null);
    setNewLocationForm((prev) => ({
      ...prev,
      venue_name: prev.venue_name || locationSearch.trim(),
    }));
  };

  const submitNewLocation = (event) => {
    event.preventDefault();
    if (!newLocationForm.venue_name.trim() || !newLocationForm.city.trim() || !newLocationForm.state.trim()) {
      setLocationFormError("Venue name, city, and state are required.");
      return;
    }
    setLocationFormError("");
    createLocationMutation.mutate(newLocationForm);
  };

  const validateAllSeatRowsForDates = (dates) => {
    for (const d of dates) {
      if (!d?.date?.trim()) {
        setSeatErrors("Every session date must have a calendar date.");
        return false;
      }
      if (!String(d.location || "").trim()) {
        setSeatErrors("Every session date must have a location.");
        return false;
      }
      const max = parseSeatField(d.max_seats);
      const avail = parseSeatField(d.available_seats);
      if (max == null || max < 0 || avail == null || avail < 0) {
        setSeatErrors("Every session date requires max seats (0 or more) and available seats (0 or more).");
        return false;
      }
      if (avail > max) {
        setSeatErrors("Available seats cannot be greater than max seats.");
        return false;
      }
    }
    setSeatErrors("");
    return true;
  };

  const handleSaveClick = () => {
    if (saveInFlightRef.current || saving) return;
    if (!form.template_id) return;
    const flat = flattenSessions(sessions);
    if (flat.length === 0) return;
    const normalized = normalizeScheduledSessionDatesEntries(flat, previousSessionDatesForNormalize);
    if (!validateAllSeatRowsForDates(normalized)) return;
    setForm((prev) => ({ ...prev, session_dates: normalized }));
    saveInFlightRef.current = true;
    onSave({ session_dates: normalized });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Scheduled Course" : "Schedule a Course"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Template picker */}
          <div>
            <Label>Course Template *</Label>
            <Select value={form.template_id} onValueChange={handleTemplateSelect}>
              <SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs mt-1.5 px-1" style={{ color: "#8891a8" }}>
                {selectedTemplate.category?.replace("_", " ")} · {selectedTemplate.level} · {selectedTemplate.duration_hours}h
              </p>
            )}
          </div>

          {/* Overrides */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Display Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Defaults to template title" />
            </div>
            <div className="col-span-2">
              <Label>Price ($)</Label>
              <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value || "" })} placeholder="Override template price" />
            </div>
            <div className="col-span-2">
              <Label>Instructor</Label>
              <Input value={form.instructor_name} onChange={e => setForm({ ...form, instructor_name: e.target.value })} placeholder="Defaults to template instructor" />
            </div>
          </div>

          {/* Sessions */}
          <div className="border rounded-xl p-4 space-y-3" style={{ background: "rgba(74,95,160,0.04)", borderColor: "rgba(74,95,160,0.2)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: "#4a5fa0" }} />
                <p className="font-semibold text-sm" style={{ color: "#1a2540" }}>Sessions</p>
                <span className="text-xs" style={{ color: "#8891a8" }}>Each session can include multiple days</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSession}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Session
              </Button>
            </div>

            {(sessions || []).length === 0 && (
              <p className="text-xs italic" style={{ color: "#b0b8cc" }}>
                No sessions created yet. Create at least one session, then add dates.
              </p>
            )}

            <div className="space-y-3">
              {(sessions || []).map((session, sessionIdx) => (
                <div key={session.id} className="rounded-xl border bg-white/70 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSessionCollapse(session.id)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label={collapsedBySession[session.id] ? "Expand session" : "Collapse session"}
                    >
                      {collapsedBySession[session.id] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <Input
                      value={session.name}
                      onChange={(e) => renameSession(session.id, e.target.value)}
                      placeholder={`Session ${sessionIdx + 1}`}
                      className="h-8"
                    />
                    <button type="button" onClick={() => removeSession(session.id)} className="text-slate-300 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {!collapsedBySession[session.id] && (
                    <>
                      <div className="space-y-2">
                        {(session.dates || []).map((s) => (
                          <div key={s._localId} className="space-y-2 bg-white rounded-xl px-3 py-2.5 border text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4a5fa0" }} />
                              <div className="flex-1 min-w-0">
                                {s.label && <span className="font-semibold text-xs mr-2" style={{ color: "#4a5fa0" }}>{s.label}</span>}
                                <span className="font-medium" style={{ color: "#1a2540" }}>{s.date}</span>
                                {(s.start_time || s.end_time) && <span className="ml-2" style={{ color: "#8891a8" }}>{s.start_time}{s.end_time ? ` – ${s.end_time}` : ""}</span>}
                                {s.location && <span className="ml-2" style={{ color: "#8891a8" }}>· {s.location}</span>}
                                {Number.isFinite(Number(s.max_seats)) && Number.isFinite(Number(s.available_seats)) && (
                                  <span
                                    className="ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5 align-middle"
                                    style={{ background: "rgba(74,95,160,0.12)", color: "#2f437d" }}
                                    title="Remaining bookable seats vs capacity for this date (updates after enrollments)"
                                  >
                                    Seats: {s.available_seats} / {s.max_seats}
                                  </span>
                                )}
                              </div>
                              <button type="button" onClick={() => removeDateFromSession(session.id, s._localId)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pl-6">
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide">Max seats *</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8 text-xs"
                                  value={s.max_seats === undefined || s.max_seats === null ? "" : s.max_seats}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const maxVal = v === "" ? NaN : Number(v);
                                    const maxNum = Number.isFinite(maxVal) && maxVal >= 0 ? Math.floor(maxVal) : null;
                                    if (maxNum == null) {
                                      updateDateEntryInSession(session.id, s._localId, {
                                        max_seats: "",
                                        available_seats: s.available_seats,
                                      });
                                      return;
                                    }
                                    const prevMax = Number.isFinite(Number(s.max_seats)) ? Math.floor(Number(s.max_seats)) : NaN;
                                    let avail = Number(s.available_seats);
                                    if (!Number.isFinite(avail)) avail = maxNum;
                                    if (Number.isFinite(prevMax) && prevMax > 0 && maxNum > prevMax) avail += maxNum - prevMax;
                                    else if (Number.isFinite(prevMax) && prevMax > 0 && maxNum < prevMax) avail = Math.min(avail, maxNum);
                                    else avail = Math.min(maxNum, Math.max(0, avail));
                                    updateDateEntryInSession(session.id, s._localId, {
                                      max_seats: maxNum,
                                      available_seats: Math.min(maxNum, Math.max(0, avail)),
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide">Available *</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8 text-xs"
                                  disabled={
                                    s.max_seats === "" ||
                                    s.max_seats === undefined ||
                                    s.max_seats === null ||
                                    !Number.isFinite(Number(s.max_seats)) ||
                                    Math.floor(Number(s.max_seats)) < 0
                                  }
                                  value={s.available_seats === undefined || s.available_seats === null ? "" : s.available_seats}
                                  onChange={(e) => {
                                    const maxNum = Math.floor(Number(s.max_seats));
                                    if (!Number.isFinite(maxNum) || maxNum < 0) return;
                                    const raw = e.target.value;
                                    const v = raw === "" ? NaN : Number(raw);
                                    const avail = Number.isFinite(v) ? Math.min(maxNum, Math.max(0, Math.floor(v))) : "";
                                    updateDateEntryInSession(session.id, s._localId, { available_seats: avail });
                                  }}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] pl-6" style={{ color: "#8891a8" }}>
                              Location, max seats, and available seats are required on every date. Use 0 / 0 for no capacity. Available cannot exceed max.
                            </p>
                          </div>
                        ))}
                        {(session.dates || []).length === 0 && (
                          <p className="text-xs italic" style={{ color: "#b0b8cc" }}>No dates added in this session yet.</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Date *</Label>
                          <Input
                            type="date"
                            value={(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).date}
                            onChange={(e) => updateDateDraft(session.id, { date: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Label (optional)</Label>
                          <Input
                            placeholder="e.g. Day 1, Morning"
                            value={(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).label}
                            onChange={(e) => updateDateDraft(session.id, { label: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Start Time</Label>
                          <Input
                            type="time"
                            value={(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).start_time}
                            onChange={(e) => updateDateDraft(session.id, { start_time: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">End Time</Label>
                          <Input
                            type="time"
                            value={(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).end_time}
                            onChange={(e) => updateDateDraft(session.id, { end_time: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Location *</Label>
                            <button
                              type="button"
                              className="text-xs font-semibold hover:underline"
                              style={{ color: "#4a5fa0" }}
                              onClick={() => openAddLocationForm(session.id)}
                            >
                              + Add New Location
                            </button>
                          </div>
                          <Popover
                            open={locationPickerSessionId === session.id}
                            onOpenChange={(nextOpen) => {
                              setLocationPickerSessionId(nextOpen ? session.id : null);
                              if (nextOpen) setShowAddLocationFormSessionId(null);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                <span className="truncate text-left">
                                  {(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).location || "Search and select a location..."}
                                </span>
                                <ChevronDown className="w-4 h-4 opacity-60" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Search venue, city, state..."
                                  value={locationSearch}
                                  onValueChange={setLocationSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {loadingLocations ? "Searching locations..." : "No matching locations."}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {locationOptions.map((location) => {
                                      const label = locationDisplayName(location);
                                      const isSelected = (newDatesBySession[session.id] || EMPTY_DATE_DRAFT).location === label;
                                      return (
                                        <CommandItem
                                          key={location.id}
                                          value={`${location.venue_name} ${location.city} ${location.state} ${location.zip_code || ""}`}
                                          onSelect={() => handleLocationSelect(session.id, location)}
                                        >
                                          <Check className={`w-4 h-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                          <div className="min-w-0">
                                            <p className="truncate">{label}</p>
                                            {location.street_address && (
                                              <p className="text-xs truncate text-slate-500">{location.street_address}</p>
                                            )}
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                              <div className="border-t px-3 py-2">
                                <button
                                  type="button"
                                  className="text-xs font-semibold hover:underline"
                                  style={{ color: "#4a5fa0" }}
                                  onClick={() => openAddLocationForm(session.id)}
                                >
                                  + Add location not in the list
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs px-1" style={{ color: "#8891a8" }}>
                            Select from saved locations or add a new one.
                          </p>
                          {showAddLocationFormSessionId === session.id && (
                            <form
                              onSubmit={submitNewLocation}
                              className="rounded-xl border p-3 space-y-2.5"
                              style={{
                                background: "rgba(255,255,255,0.78)",
                                borderColor: "rgba(218,106,99,0.25)",
                                boxShadow: "0 2px 10px rgba(30,37,53,0.05)",
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold" style={{ color: "#1a2540" }}>New Location</p>
                                <button
                                  type="button"
                                  className="text-xs font-semibold hover:underline"
                                  style={{ color: "#8891a8" }}
                                  onClick={() => {
                                    setShowAddLocationFormSessionId(null);
                                    setNewLocationTargetSessionId(null);
                                    setLocationFormError("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                              <Input
                                placeholder="Venue name (e.g., Main Studio)"
                                value={newLocationForm.venue_name}
                                onChange={(e) => setNewLocationForm((prev) => ({ ...prev, venue_name: e.target.value }))}
                              />
                              <Input
                                placeholder="Street address"
                                value={newLocationForm.street_address}
                                onChange={(e) => setNewLocationForm((prev) => ({ ...prev, street_address: e.target.value }))}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="City"
                                  value={newLocationForm.city}
                                  onChange={(e) => setNewLocationForm((prev) => ({ ...prev, city: e.target.value }))}
                                />
                                <Input
                                  placeholder="State"
                                  value={newLocationForm.state}
                                  onChange={(e) => setNewLocationForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
                                />
                              </div>
                              <Input
                                placeholder="Zip code (optional)"
                                value={newLocationForm.zip_code}
                                onChange={(e) => setNewLocationForm((prev) => ({ ...prev, zip_code: e.target.value }))}
                              />
                              {locationFormError && (
                                <p className="text-xs text-red-500">{locationFormError}</p>
                              )}
                              <Button
                                type="submit"
                                className="w-full"
                                disabled={createLocationMutation.isPending}
                                style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "#fff" }}
                              >
                                {createLocationMutation.isPending ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Adding...
                                  </span>
                                ) : (
                                  "Add Location"
                                )}
                              </Button>
                            </form>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">Max seats *</Label>
                          <Input
                            type="number"
                            min={0}
                            value={(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).max_seats}
                            onChange={(e) => updateDateDraft(session.id, { max_seats: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Available seats *</Label>
                          <Input
                            type="number"
                            min={0}
                            value={(newDatesBySession[session.id] || EMPTY_DATE_DRAFT).available_seats}
                            onChange={(e) => updateDateDraft(session.id, { available_seats: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => addDateToSession(session.id)}
                        className="w-full text-sm font-semibold rounded-xl"
                        style={{ background: "rgba(74,95,160,0.12)", color: "#2f437d", border: "1px solid rgba(74,95,160,0.3)" }}
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> Add Date to Session
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Visible to providers</Label></div>
          <div className="flex items-center gap-3"><Switch checked={form.is_featured} onCheckedChange={v => setForm({ ...form, is_featured: v })} /><Label>Featured</Label></div>

          {seatErrors && (
            <p className="text-sm text-red-600 px-1">{seatErrors}</p>
          )}

          <div className="flex gap-3 pt-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={handleSaveClick}
              disabled={saving || !form.template_id || flattenSessions(sessions).length === 0}
              style={{ background: "linear-gradient(135deg, #DA6A63, #FA6F30)", color: "#fff" }}
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Schedule Course"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}