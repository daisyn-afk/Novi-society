import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MapPin, CheckSquare, Square, ChevronDown, ChevronUp, Users, Clock, Package, AlertCircle, Plus, Trash2, Edit2, Check, X, RefreshCw, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";

const INITIAL_SUPPLIES = [
  { id: 1, name: "Neurotoxin (Botox, Xeomin, Dysport, etc.)", purchaseType: "every_course", qty: null },
  { id: 2, name: "Dermal filler (Juvederm, Restylane, etc.)", purchaseType: "every_course", qty: null },
  { id: 3, name: "Bacteriostatic Saline (0.9% Sodium Chloride)", purchaseType: "every_course", qty: null },
  { id: 4, name: "Reconstitution Syringe — 3 mL Luer-Lock syringe", purchaseType: "every_course", qty: null },
  { id: 5, name: "Reconstitution Needle — 23G (Brand: ZIG)", purchaseType: "every_course", qty: null },
  { id: 6, name: "Vial Decapper Tool (13mm / 20mm)", purchaseType: "one_time", qty: 1 },
  { id: 7, name: "Insulin Syringes — 31G, 5/16\" (8mm), 0.3 cc (standard for neurotoxin)", purchaseType: "every_course", qty: null },
  { id: 8, name: "Alcohol prep pads", purchaseType: "every_course", qty: null },
  { id: 9, name: "White skin marking pencils", purchaseType: "every_course", qty: null },
  { id: 10, name: "Pencil sharpeners", purchaseType: "one_time", qty: 2 },
  { id: 11, name: "Numbing Cream", purchaseType: "every_course", qty: null },
  { id: 12, name: "Dental bibs", purchaseType: "every_course", qty: null },
  { id: 13, name: "Face sheets / facial anatomy mapping sheets", purchaseType: "every_course", qty: null },
  { id: 14, name: "Gauze (2x2 or 4x4)", purchaseType: "every_course", qty: null },
  { id: 15, name: "Cotton tip applicators", purchaseType: "every_course", qty: null },
  { id: 16, name: "Handheld mirrors", purchaseType: "one_time", qty: 4 },
  { id: 17, name: "Stress squeeze balls", purchaseType: "one_time", qty: 4 },
  { id: 18, name: "Disposable draping", purchaseType: "every_course", qty: null },
  { id: 19, name: "Silicone practice faces / injection practice heads", purchaseType: "one_time", qty: 2 },
  { id: 20, name: "Sharps containers", purchaseType: "every_course", qty: null },
  { id: 21, name: "Nitrile gloves", purchaseType: "every_course", qty: null },
  { id: 22, name: "Biohazard bags", purchaseType: "every_course", qty: null },
];

function SupplyEditor({ supplies, onSave, onCancel }) {
  const [items, setItems] = useState(supplies.map(s => ({ ...s })));
  const [newItem, setNewItem] = useState({ name: "", purchaseType: "every_course", qty: "" });
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState({});

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditVal({ name: item.name, purchaseType: item.purchaseType, qty: item.qty ?? "" });
  };
  const saveEdit = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...editVal, qty: editVal.qty === "" ? null : Number(editVal.qty) } : i));
    setEditingId(null);
  };
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const addItem = () => {
    if (!newItem.name.trim()) return;
    setItems(prev => [...prev, { id: Date.now(), name: newItem.name.trim(), purchaseType: newItem.purchaseType, qty: newItem.qty === "" ? null : Number(newItem.qty) }]);
    setNewItem({ name: "", purchaseType: "every_course", qty: "" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(250,111,48,0.25)", background: "rgba(250,111,48,0.04)" }}>
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(250,111,48,0.15)" }}>
          <Plus className="w-3.5 h-3.5" style={{ color: "#FA6F30" }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#FA6F30" }}>Add New Item</span>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-48">
            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(30,37,53,0.6)" }}>Item Name</p>
            <Input value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} placeholder="e.g. Marking tape" className="h-8 text-sm" onKeyDown={e => e.key === "Enter" && addItem()} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(30,37,53,0.6)" }}>Purchase Type</p>
            <select value={newItem.purchaseType} onChange={e => setNewItem(n => ({ ...n, purchaseType: e.target.value }))}
              className="h-8 text-xs rounded-lg px-2 outline-none" style={{ background: "white", border: "1px solid rgba(30,37,53,0.15)", color: "#1e2535" }}>
              <option value="every_course">Every Course</option>
              <option value="one_time">One-Time</option>
            </select>
          </div>
          <div className="w-20">
            <p className="text-xs font-semibold mb-1" style={{ color: "rgba(30,37,53,0.6)" }}>Qty</p>
            <Input type="number" min="1" value={newItem.qty} onChange={e => setNewItem(n => ({ ...n, qty: e.target.value }))} placeholder="—" className="h-8 text-sm" />
          </div>
          <button onClick={addItem} disabled={!newItem.name.trim()}
            className="h-8 px-4 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "#FA6F30" }}>
            Add
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.08)" }}>
            {editingId === item.id ? (
              <>
                <Input value={editVal.name} onChange={e => setEditVal(v => ({ ...v, name: e.target.value }))} className="flex-1 h-7 text-xs" />
                <select value={editVal.purchaseType} onChange={e => setEditVal(v => ({ ...v, purchaseType: e.target.value }))}
                  className="h-7 text-xs rounded-lg px-2 outline-none" style={{ background: "white", border: "1px solid rgba(30,37,53,0.15)" }}>
                  <option value="every_course">Every Course</option>
                  <option value="one_time">One-Time</option>
                </select>
                <Input type="number" min="1" value={editVal.qty} onChange={e => setEditVal(v => ({ ...v, qty: e.target.value }))} placeholder="—" className="w-16 h-7 text-xs" />
                <button onClick={() => saveEdit(item.id)} className="p-1 rounded-lg" style={{ color: "#22c55e" }}><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingId(null)} className="p-1 rounded-lg" style={{ color: "#DA6A63" }}><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-xs font-medium" style={{ color: "#1e2535" }}>{item.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 flex-shrink-0"
                  style={{ background: item.purchaseType === "one_time" ? "rgba(123,142,200,0.12)" : "rgba(200,230,60,0.12)", color: item.purchaseType === "one_time" ? "#7B8EC8" : "#4a6b10" }}>
                  {item.purchaseType === "one_time" ? <><RefreshCw className="w-2.5 h-2.5" /> One-Time</> : <><Repeat className="w-2.5 h-2.5" /> Every Course</>}
                </span>
                <span className="text-xs w-10 text-center font-semibold flex-shrink-0" style={{ color: item.qty ? "#1e2535" : "rgba(30,37,53,0.3)" }}>
                  {item.qty ? `×${item.qty}` : "—"}
                </span>
                <button onClick={() => startEdit(item)} className="p-1 rounded-lg hover:bg-black/5"><Edit2 className="w-3.5 h-3.5" style={{ color: "rgba(30,37,53,0.4)" }} /></button>
                <button onClick={() => removeItem(item.id)} className="p-1 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" style={{ color: "#DA6A63" }} /></button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.6)" }}>Cancel</button>
        <button onClick={() => onSave(items)} className="flex-1 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#FA6F30" }}>Save Checklist</button>
      </div>
    </div>
  );
}

export default function TrainerPrepView({ scheduledCourses = [], enrollments = [] }) {
  const [expanded, setExpanded] = useState(null);
  const [checks, setChecks] = useState({});
  const [supplies, setSupplies] = useState(INITIAL_SUPPLIES);
  const [editingSupplies, setEditingSupplies] = useState(false);

  const now = new Date();
  const upcomingCourses = scheduledCourses
    .filter(c => {
      const dates = (c.session_dates || []).filter(d => { try { return parseISO(d.date) >= now; } catch { return false; } });
      return dates.length > 0;
    })
    .sort((a, b) => {
      const aDate = (a.session_dates || []).map(d => d.date).sort()[0] || "";
      const bDate = (b.session_dates || []).map(d => d.date).sort()[0] || "";
      return aDate > bDate ? 1 : -1;
    });

  const enrollCountFor = (id) => enrollments.filter(e => e.course_id === id && !["cancelled", "no_show"].includes(e.status)).length;
  const toggleCheck = (courseId, itemId) => setChecks(prev => ({ ...prev, [courseId]: { ...(prev[courseId] || {}), [itemId]: !(prev[courseId]?.[itemId]) } }));
  const checkCount = (courseId) => Object.values(checks[courseId] || {}).filter(Boolean).length;
  const nextSessionDate = (course) => {
    const sorted = (course.session_dates || []).filter(d => { try { return parseISO(d.date) >= now; } catch { return false; } }).sort((a, b) => a.date > b.date ? 1 : -1);
    return sorted[0] || null;
  };

  const total = supplies.length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-1" style={{ background: "rgba(218,106,99,0.07)", border: "1px solid rgba(218,106,99,0.2)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#DA6A63" }} />
          <p className="text-sm" style={{ color: "#DA6A63" }}>
            <strong>Trainer Prep Checklist</strong> — Review location, enrolled count, and confirm all supplies before each training session.
          </p>
        </div>
        <button onClick={() => setEditingSupplies(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white flex-shrink-0"
          style={{ background: "#FA6F30" }}>
          <Edit2 className="w-3.5 h-3.5" /> Edit Master List
        </button>
      </div>

      {/* Supply editor modal */}
      {editingSupplies && (
        <div className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 4px 24px rgba(30,37,53,0.12)" }}>
          <h3 className="font-bold text-base mb-4" style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}>Edit Master Supply List</h3>
          <SupplyEditor
            supplies={supplies}
            onSave={(updated) => { setSupplies(updated); setEditingSupplies(false); setChecks({}); }}
            onCancel={() => setEditingSupplies(false)}
          />
        </div>
      )}

      {upcomingCourses.length === 0 ? (
        <div className="rounded-3xl py-16 text-center" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
          <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "#d0d5e0" }} />
          <p className="font-semibold mb-1" style={{ color: "#1a2540" }}>No upcoming scheduled courses</p>
          <p className="text-sm" style={{ color: "#b0b8cc" }}>Schedule a course first to see trainer prep checklists.</p>
        </div>
      ) : (
        upcomingCourses.map(course => {
          const isOpen = expanded === course.id;
          const enrollCount = enrollCountFor(course.id);
          const done = checkCount(course.id);
          const pct = Math.round((done / total) * 100);
          const next = nextSessionDate(course);

          return (
            <div key={course.id} className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 2px 12px rgba(30,37,53,0.07)" }}>
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-black/5 transition-colors" onClick={() => setExpanded(isOpen ? null : course.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-sm" style={{ color: "#1a2540" }}>{course.title}</p>
                    {next && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(218,106,99,0.1)", color: "#DA6A63" }}>
                        Next: {format(parseISO(next.date), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs flex-wrap" style={{ color: "#8891a8" }}>
                    {next?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{next.location}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{enrollCount} enrolled</span>
                    {course.instructor_name && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Trainer: {course.instructor_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: done === total ? "#22c55e" : "#DA6A63" }}>{done}/{total}</div>
                    <div className="text-xs" style={{ color: "#b0b8cc" }}>items</div>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: done === total ? "rgba(34,197,94,0.12)" : "rgba(218,106,99,0.1)", color: done === total ? "#22c55e" : "#DA6A63", border: `2px solid ${done === total ? "#22c55e" : "#DA6A63"}` }}>
                    {pct}%
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: "#b0b8cc" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#b0b8cc" }} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  {/* Session Schedule */}
                  <div className="px-5 py-4 space-y-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8891a8" }}>Session Schedule & Locations</h4>
                    <div className="space-y-2">
                      {(course.session_dates || []).map((sd, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(74,95,160,0.05)", border: "1px solid rgba(74,95,160,0.1)" }}>
                          <div className="text-center w-12">
                            <div className="text-xs font-bold" style={{ color: "#DA6A63" }}>{sd.date ? format(parseISO(sd.date), "MMM").toUpperCase() : ""}</div>
                            <div className="text-xl font-black" style={{ color: "#1a2540", lineHeight: 1 }}>{sd.date ? format(parseISO(sd.date), "d") : "—"}</div>
                          </div>
                          <div className="flex-1">
                            {sd.label && <p className="text-xs font-bold mb-0.5" style={{ color: "#4a5fa0" }}>{sd.label}</p>}
                            <div className="flex gap-3 text-xs flex-wrap" style={{ color: "#8891a8" }}>
                              {(sd.start_time || sd.end_time) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sd.start_time}{sd.end_time ? `–${sd.end_time}` : ""}</span>}
                              {(sd.location || course.location) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sd.location || course.location}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enrolled Providers */}
                  <div className="px-5 py-4 space-y-2" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#8891a8" }}>Enrolled Providers ({enrollCount})</h4>
                    {enrollCount === 0 && <p className="text-xs" style={{ color: "#b0b8cc" }}>No confirmed enrollments yet.</p>}
                  </div>

                  {/* Supplies Checklist */}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8891a8" }}>Supplies Checklist</h4>
                      {done > 0 && (
                        <button className="text-xs" style={{ color: "#b0b8cc" }} onClick={() => setChecks(p => ({ ...p, [course.id]: {} }))}>Reset</button>
                      )}
                    </div>
                    <div className="w-full rounded-full h-1.5 mb-4" style={{ background: "rgba(0,0,0,0.07)" }}>
                      <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: done === total ? "#22c55e" : "linear-gradient(90deg, #DA6A63, #FA6F30)" }} />
                    </div>

                    {/* Legend */}
                    <div className="flex gap-3 mb-3">
                      <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#C8E63C" }} /> Every Course
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#7B8EC8" }} /> One-Time Purchase
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {supplies.map((item) => {
                        const checked = checks[course.id]?.[item.id] || false;
                        const isOneTime = item.purchaseType === "one_time";
                        return (
                          <button key={item.id} onClick={() => toggleCheck(course.id, item.id)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-black/5"
                            style={{ background: checked ? "rgba(34,197,94,0.06)" : "rgba(0,0,0,0.02)", border: `1px solid ${checked ? "rgba(34,197,94,0.2)" : "rgba(0,0,0,0.05)"}` }}>
                            {checked
                              ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
                              : <Square className="w-4 h-4 flex-shrink-0" style={{ color: "#b0b8cc" }} />
                            }
                            <span className="flex-1 text-xs" style={{ color: checked ? "#22c55e" : "#4a5575", textDecoration: checked ? "line-through" : "none" }}>{item.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.qty && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(30,37,53,0.06)", color: "rgba(30,37,53,0.5)" }}>×{item.qty}</span>
                              )}
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOneTime ? "#7B8EC8" : "#C8E63C" }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}