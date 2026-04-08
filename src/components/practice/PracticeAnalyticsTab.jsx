import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  DollarSign, Users, Star, Repeat, TrendingUp, TrendingDown,
  BarChart2, CheckCircle2, AlertCircle, Lightbulb, Trophy, Heart, ChevronDown, ChevronUp
} from "lucide-react";

// ─── Design tokens ───────────────────────────────────────────────
const GLASS = { background: "rgba(255,255,255,0.75)", border: "1px solid rgba(30,37,53,0.07)", borderRadius: 20, boxShadow: "0 2px 12px rgba(30,37,53,0.05)" };
const TT = { contentStyle: { background: "#fff", border: "1px solid rgba(30,37,53,0.1)", borderRadius: 10, fontSize: 12, color: "#1e2535" }, cursor: { fill: "rgba(30,37,53,0.03)" } };

// ─── Helpers ─────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return { bg: "#C8E63C", text: "#4a6b10", label: "Thriving" };
  if (score >= 60) return { bg: "#FA6F30", text: "#b04010", label: "Growing" };
  return { bg: "#DA6A63", text: "#8b2020", label: "Getting Started" };
}

function MetricCard({ icon: Icon, color, title, value, explanation, action, good, warn }) {
  const border = warn ? "1.5px solid rgba(218,106,99,0.3)" : good ? "1.5px solid rgba(200,230,60,0.35)" : "1px solid rgba(30,37,53,0.07)";
  return (
    <div className="rounded-xl p-3" style={{ ...GLASS, border }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <div className="flex-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold" style={{ color: "#1e2535" }}>{title}</p>
          {(good || warn) && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{
              background: warn ? "rgba(218,106,99,0.12)" : "rgba(200,230,60,0.18)",
              color: warn ? "#DA6A63" : "#4a6b10"
            }}>
              {warn ? "⚠" : "✓"}
            </span>
          )}
        </div>
      </div>
      <p className="font-bold mb-1" style={{ fontSize: 22, color: "#1e2535", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{value}</p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.5)", fontSize: 11 }}>{explanation}</p>
      {action && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.06)" }}>
          <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#FA6F30" }} />
          <p style={{ fontSize: 11, color: "rgba(30,37,53,0.6)", lineHeight: 1.4 }}>{action}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ iconColor, title, subtitle, icon: SectionIcon, isOpen, onToggle }) {
  return (
    <button className="w-full flex items-center gap-3 text-left" onClick={onToggle}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}20` }}>
        <SectionIcon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: "#1e2535" }}>{title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>{subtitle}</p>
      </div>
      <div className="flex-shrink-0">
        {isOpen
          ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.2)" }} />
          : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.2)" }} />}
      </div>
    </button>
  );
}

function CollapsibleSection({ id, iconColor, title, subtitle, icon, openSections, toggle, children }) {
  const isOpen = openSections.has(id);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(30,37,53,0.07)" }}>
      <div className="px-4 py-3.5">
        <SectionHeader iconColor={iconColor} title={title} subtitle={subtitle} icon={icon} isOpen={isOpen} onToggle={() => toggle(id)} />
      </div>
      {isOpen && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(30,37,53,0.06)" }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

function BenchRow({ label, yours, avg, top, fmt }) {
  const display = v => v == null ? "—" : fmt ? fmt(v) : (Number.isInteger(v) ? v : parseFloat(v).toFixed(1));
  const pct = top > 0 ? Math.min((yours / top) * 100, 100) : 0;
  const avgPct = top > 0 ? Math.min((avg / top) * 100, 100) : 0;
  const isGood = yours >= avg;
  return (
    <div className="py-3" style={{ borderBottom: "1px solid rgba(30,37,53,0.05)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: "#1e2535" }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: isGood ? "#4a6b10" : "#DA6A63" }}>{display(yours)}</span>
          {isGood
            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(200,230,60,0.18)", color: "#4a6b10" }}>↑ Above avg</span>
            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(218,106,99,0.12)", color: "#DA6A63" }}>↓ Below avg</span>
          }
        </div>
      </div>
      <div className="h-2 rounded-full relative overflow-hidden" style={{ background: "rgba(30,37,53,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: isGood ? "#C8E63C" : "#FA6F30" }} />
        <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${avgPct}%`, background: "rgba(30,37,53,0.25)" }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>Platform avg: {display(avg)}</span>
        <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>Top: {display(top)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function PracticeAnalyticsTab({ appointments, reviews }) {
  const now = new Date();
  const last6 = eachMonthOfInterval({ start: subMonths(now, 5), end: now });
  const thisMonth = { start: startOfMonth(now), end: endOfMonth(now) };
  const prevMonth = { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };

  // ── Data calculations ──
  const completedAppts = appointments.filter(a => a.status === "completed");
  const cancelledAppts = appointments.filter(a => a.status === "cancelled");
  const noShowAppts = appointments.filter(a => a.status === "no_show");
  const total = appointments.length;

  const totalRevenue = completedAppts.reduce((s, a) => s + (a.amount_paid || 0), 0);
  const thisMonthRevenue = completedAppts
    .filter(a => a.appointment_date && isWithinInterval(new Date(a.appointment_date), thisMonth))
    .reduce((s, a) => s + (a.amount_paid || 0), 0);
  const prevMonthRevenue = completedAppts
    .filter(a => a.appointment_date && isWithinInterval(new Date(a.appointment_date), prevMonth))
    .reduce((s, a) => s + (a.amount_paid || 0), 0);
  const revTrend = prevMonthRevenue > 0 ? Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : null;
  const avgPerAppt = completedAppts.length > 0 ? Math.round(totalRevenue / completedAppts.length) : 0;

  const patientMap = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      const key = a.patient_id || a.patient_email; if (!key) return;
      if (!map[key]) map[key] = { count: 0, name: a.patient_name, revenue: 0 };
      map[key].count++;
      if (a.status === "completed") map[key].revenue += (a.amount_paid || 0);
    });
    return map;
  }, [appointments]);

  const totalPatients = Object.keys(patientMap).length;
  const returningPatients = Object.values(patientMap).filter(p => p.count > 1).length;
  const retentionRate = totalPatients > 0 ? Math.round((returningPatients / totalPatients) * 100) : 0;
  const conversionRate = total > 0 ? Math.round((completedAppts.length / total) * 100) : 0;
  const noShowRate = total > 0 ? Math.round((noShowAppts.length / total) * 100) : 0;
  const avgRating = reviews.length ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : null;

  // ── Practice Health Score (0–100) ──
  const healthScore = useMemo(() => {
    if (total === 0) return 0;
    let score = 0;
    score += Math.min(conversionRate * 0.3, 30);       // up to 30 pts
    score += Math.min(retentionRate * 0.25, 25);        // up to 25 pts
    score += avgRating ? Math.min(((avgRating - 1) / 4) * 20, 20) : 5; // up to 20 pts
    score += Math.min(100 - noShowRate, 25);            // up to 25 pts (inverted)
    return Math.round(Math.min(score, 100));
  }, [conversionRate, retentionRate, avgRating, noShowRate, total]);

  // ── Monthly chart data ──
  const monthlyData = useMemo(() => last6.map(month => {
    const start = startOfMonth(month), end = endOfMonth(month);
    const inMonth = appointments.filter(a => a.appointment_date && isWithinInterval(new Date(a.appointment_date), { start, end }));
    const comp = inMonth.filter(a => a.status === "completed");
    return {
      month: format(month, "MMM"),
      completed: comp.length,
      revenue: comp.reduce((s, a) => s + (a.amount_paid || 0), 0),
    };
  }), [appointments]);

  const topPatients = Object.entries(patientMap).sort(([,a],[,b]) => b.revenue - a.revenue).slice(0, 5);

  const serviceMap = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      if (!a.service) return;
      if (!map[a.service]) map[a.service] = { name: a.service, count: 0, revenue: 0 };
      map[a.service].count++;
      if (a.status === "completed") map[a.service].revenue += (a.amount_paid || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [appointments]);

  // ── Benchmarks query ──
  const { data: allAppointments = [] } = useQuery({ queryKey: ["all-appts-bench"], queryFn: () => base44.entities.Appointment.list("-created_date", 500) });
  const { data: allReviews = [] } = useQuery({ queryKey: ["all-reviews-bench"], queryFn: () => base44.entities.Review.list("-created_date", 200) });

  const benchmarks = useMemo(() => {
    const pm = {};
    allAppointments.forEach(a => { if (!a.provider_id) return; if (!pm[a.provider_id]) pm[a.provider_id] = []; pm[a.provider_id].push(a); });
    const rm = {};
    allReviews.forEach(r => { if (!r.provider_id) return; if (!rm[r.provider_id]) rm[r.provider_id] = []; rm[r.provider_id].push(r.rating); });
    const stats = Object.entries(pm).map(([pid, appts]) => {
      const comp = appts.filter(a => a.status === "completed").length;
      const patMap = {}; appts.forEach(a => { if (a.patient_id) patMap[a.patient_id] = (patMap[a.patient_id] || 0) + 1; });
      const pats = Object.keys(patMap).length;
      const ret = pats > 0 ? Math.round((Object.values(patMap).filter(c => c > 1).length / pats) * 100) : 0;
      const conv = appts.length > 0 ? Math.round((comp / appts.length) * 100) : 0;
      const ratings = rm[pid] || [];
      const avgR = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
      const rev = appts.filter(a => a.status === "completed").reduce((s, a) => s + (a.amount_paid || 0), 0);
      return { pats, ret, conv, avgR, rev };
    });
    const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const max = arr => arr.length ? Math.max(...arr) : 0;
    return {
      count: stats.length,
      retention: { avg: Math.round(avg(stats.map(p => p.ret).filter(v => v > 0))), top: max(stats.map(p => p.ret)) || 80 },
      conversion: { avg: Math.round(avg(stats.map(p => p.conv).filter(v => v > 0))), top: max(stats.map(p => p.conv)) || 90 },
      patients: { avg: Math.round(avg(stats.map(p => p.pats).filter(v => v > 0))), top: max(stats.map(p => p.pats)) || 30 },
      rating: { avg: parseFloat(avg(stats.map(p => p.avgR).filter(v => v != null)).toFixed(1)), top: max(stats.map(p => p.avgR).filter(v => v != null)) || 5 },
      revenue: { avg: Math.round(avg(stats.map(p => p.rev).filter(v => v > 0))), top: max(stats.map(p => p.rev)) || 10000 },
    };
  }, [allAppointments, allReviews]);

  // ── Empty state ──
  if (total === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={GLASS}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(123,142,200,0.12)" }}>
          <BarChart2 className="w-7 h-7" style={{ color: "#7B8EC8" }} />
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1e2535" }}>Your dashboard is waiting</p>
        <p className="text-sm mt-2 max-w-xs mx-auto leading-relaxed" style={{ color: "rgba(30,37,53,0.5)" }}>
          Once you receive your first appointment, this page will come alive with insights, revenue data, and personalized recommendations to grow your practice.
        </p>
      </div>
    );
  }

  const sc = scoreColor(healthScore);

  const [openSections, setOpenSections] = useState(new Set(["revenue"]));
  const toggle = (id) => setOpenSections(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="space-y-3 max-w-3xl">

      {/* ── Practice Health Score ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3550 100%)", boxShadow: "0 4px 24px rgba(30,37,53,0.15)" }}>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "rgba(200,230,60,0.7)", letterSpacing: "0.15em" }}>Practice Score</p>
              <p className="font-semibold" style={{ fontSize: 15, color: "#fff", lineHeight: 1.4 }}>One number. The whole picture.</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>Conversion + retention + rating + no-shows. Max is 100.</p>
            </div>
            <div className="flex-shrink-0 text-center">
              <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center" style={{ background: `${sc.bg}22`, border: `2px solid ${sc.bg}60` }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 30, fontWeight: 700, color: sc.bg, lineHeight: 1 }}>{healthScore}</p>
              </div>
              <p className="text-[10px] font-bold mt-1" style={{ color: sc.bg }}>{sc.label}</p>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${healthScore}%`, background: `linear-gradient(90deg, ${sc.bg}, #7B8EC8)` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>Just starting</span>
            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>Growing</span>
            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>Thriving</span>
          </div>
        </div>
      </div>

      {/* ── Revenue ── */}
      <CollapsibleSection id="revenue" iconColor="#C8E63C" icon={DollarSign} title="Money" subtitle="What's coming in — and what each visit is actually worth." openSections={openSections} toggle={toggle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <MetricCard icon={DollarSign} color="#C8E63C" title="This month" value={`$${thisMonthRevenue.toLocaleString()}`} explanation={revTrend != null && revTrend > 0 ? `Up ${revTrend}% from last month. All-time: $${totalRevenue.toLocaleString()}.` : revTrend != null && revTrend < 0 ? `Down ${Math.abs(revTrend)}% from last month. All-time: $${totalRevenue.toLocaleString()}.` : `All-time: $${totalRevenue.toLocaleString()}.`} action={revTrend != null && revTrend < 0 ? `Down ${Math.abs(revTrend)}% from last month — text a few past patients something simple. Even one rebooked visit turns this around.` : revTrend != null && revTrend > 0 ? `Nice — you're on an upswing. Consistency is your best friend right now.` : null} good={revTrend != null && revTrend > 0} warn={revTrend != null && revTrend < -10} />
          <MetricCard icon={TrendingUp} color="#7B8EC8" title="Per visit" value={`$${avgPerAppt}`} explanation={`You make $${avgPerAppt} on average every time someone walks out your door.`} action={avgPerAppt < 150 ? "Add a simple $25–40 add-on to your most popular service. Most patients say yes when it's framed as a quick enhancement." : null} />
        </div>
        {totalRevenue > 0 && (
          <div className="rounded-2xl p-5" style={GLASS}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#1e2535" }}>Last 6 months</p>
            <p className="text-[11px] mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Revenue from completed visits only.</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={monthlyData}>
                <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#C8E63C" stopOpacity={0.3} /><stop offset="95%" stopColor="#C8E63C" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,37,53,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={v => `$${v}`} />
                <Tooltip {...TT} formatter={v => [`$${v.toLocaleString()}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#C8E63C" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: "#C8E63C", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="patients" iconColor="#DA6A63" icon={Repeat} title="Patients" subtitle="Total seen + how many actually come back for more." openSections={openSections} toggle={toggle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MetricCard
            icon={Users} color="#7B8EC8"
            title="Unique patients"
            value={totalPatients}
            explanation={`${totalPatients} people have booked with you. ${returningPatients} came back for a second visit or more.`}
            action={totalPatients < 10 ? "Send your booking link to 5 people today — friends, family, anyone curious. Your first 10 patients are always the hardest." : null}
          />
          <MetricCard
            icon={Repeat} color="#FA6F30"
            title="Come back rate"
            value={`${retentionRate}%`}
            explanation={`${retentionRate}% of your patients return. Repeat patients spend more, refer friends, and cost you zero to re-acquire.`}
            action={retentionRate < 40 ? "A quick 'how are you feeling?' text 48 hrs after every visit does more for retention than any ad spend." : retentionRate >= 60 ? "Strong. Your regulars are your best salespeople — ask them to send a friend." : null}
            good={retentionRate >= 50}
            warn={retentionRate < 30 && totalPatients >= 3}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="appointments" iconColor="#7B8EC8" icon={CheckCircle2} title="Show Rate" subtitle="Booked vs. actually walked in. Every gap is lost money." openSections={openSections} toggle={toggle}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <MetricCard icon={CheckCircle2} color="#C8E63C" title="Booking → visit" value={`${conversionRate}%`} explanation={`${conversionRate}% of requests become real appointments. Healthy practices run at 75%+.`} good={conversionRate >= 75} warn={conversionRate < 60 && total >= 3} action={conversionRate < 75 ? "Reply to requests within 2 hours. Speed is the single biggest factor in whether someone shows up or ghosts." : null} />
          <MetricCard icon={AlertCircle} color="#DA6A63" title="No-shows" value={`${noShowRate}%`} explanation={`${noShowRate}% confirmed and didn't show. That's time you can't get back.`} warn={noShowRate > 15} good={noShowRate <= 5} action={noShowRate > 10 ? "Night-before + 2-hour reminders cut no-shows by more than half. A small deposit also filters out the tire-kickers." : null} />
          <MetricCard icon={Star} color="#FA6F30" title="Rating" value={avgRating || "—"} explanation={reviews.length === 0 ? "No reviews yet. One ask after your next visit can start the ball rolling." : `${reviews.length} review${reviews.length !== 1 ? "s" : ""}. At ${avgRating}★ you're in solid territory on NOVI.`} good={avgRating >= 4.5} warn={avgRating != null && avgRating < 4.0} action={reviews.length < 5 ? "'Hey — would you mind leaving a quick review? It really helps.' That's it. Most patients are happy to." : null} />
        </div>
        <div className="rounded-2xl p-5" style={GLASS}>
          <p className="text-xs font-semibold mb-1" style={{ color: "#1e2535" }}>Completed visits / month</p>
          <p className="text-[11px] mb-3" style={{ color: "rgba(30,37,53,0.4)" }}>Only the ones that actually happened.</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,37,53,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(30,37,53,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...TT} />
              <Bar dataKey="completed" name="Completed visits" fill="#C8E63C" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CollapsibleSection>

      {serviceMap.length > 0 && (
        <CollapsibleSection id="services" iconColor="#FA6F30" icon={TrendingUp} title="What's Working" subtitle="Your services ranked by revenue — know what to push." openSections={openSections} toggle={toggle}>
          <div className="rounded-xl p-4" style={GLASS}>
            <div className="space-y-3">
              {serviceMap.map((s, i) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(200,230,60,0.25)", color: "#4a6b10" }}>top</span>}
                      <span className="text-xs font-semibold" style={{ color: "#1e2535" }}>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>{s.count}×</span>
                      {s.revenue > 0 && <span className="text-xs font-bold" style={{ color: "#4a6b10" }}>${s.revenue.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,37,53,0.06)" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${serviceMap[0].revenue > 0 ? (s.revenue / serviceMap[0].revenue) * 100 : (s.count / serviceMap[0].count) * 100}%`,
                      background: ["#C8E63C","#7B8EC8","#FA6F30","#DA6A63","#2D6B7F"][i % 5]
                    }} />
                  </div>
                </div>
              ))}
            </div>
            {serviceMap.length > 0 && (
              <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.18)" }}>
                <p className="text-[11px] font-medium" style={{ color: "#4a6b10" }}>
                  <strong>{serviceMap[0].name}</strong> is your anchor. Make sure it's the first thing people see on your profile.
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {topPatients.length > 0 && totalRevenue > 0 && (
        <CollapsibleSection id="patients-vip" iconColor="#7B8EC8" icon={Heart} title="Regulars" subtitle="The patients who've spent the most with you." openSections={openSections} toggle={toggle}>
          <div className="rounded-xl p-4" style={GLASS}>
            <div className="space-y-0.5">
              {topPatients.map(([id, p], i) => (
                <div key={id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: i < topPatients.length - 1 ? "1px solid rgba(30,37,53,0.05)" : "none" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: ["rgba(200,230,60,0.2)","rgba(123,142,200,0.15)","rgba(250,111,48,0.15)","rgba(218,106,99,0.12)","rgba(45,107,127,0.12)"][i % 5], color: ["#4a6b10","#7B8EC8","#FA6F30","#DA6A63","#2D6B7F"][i % 5] }}>{(p.name || "P")[0]}</div>
                  <p className="flex-1 text-xs font-medium" style={{ color: "#1e2535" }}>{p.name || "Patient"}</p>
                  <span className="text-[10px]" style={{ color: "rgba(30,37,53,0.35)" }}>{p.count}×</span>
                  {p.revenue > 0 && <span className="text-xs font-bold" style={{ color: "#4a6b10" }}>${p.revenue.toLocaleString()}</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
              <p className="text-[11px] font-medium" style={{ color: "#7B8EC8" }}>These people already trust you. One personal message asking for a referral could easily bring in 2–3 new faces.</p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection id="benchmarks" iconColor="#FA6F30" icon={BarChart2} title="The Field" subtitle={`You vs. ${benchmarks.count} other NOVI providers — real numbers.`} openSections={openSections} toggle={toggle}>
        <div className="rounded-xl p-4" style={GLASS}>
          <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "rgba(30,37,53,0.45)" }}>
            The line = platform average. Retention and conversion move the needle most.
          </p>
          <BenchRow label="Patient Retention" yours={retentionRate} avg={benchmarks.retention.avg} top={benchmarks.retention.top} fmt={v => `${v}%`} />
          <BenchRow label="Booking Conversion" yours={conversionRate} avg={benchmarks.conversion.avg} top={benchmarks.conversion.top} fmt={v => `${v}%`} />
          <BenchRow label="Unique Patients" yours={totalPatients} avg={benchmarks.patients.avg} top={benchmarks.patients.top} />
          {avgRating != null && <BenchRow label="Avg Rating" yours={avgRating} avg={benchmarks.rating.avg} top={benchmarks.rating.top} />}
          <BenchRow label="Total Revenue" yours={totalRevenue} avg={benchmarks.revenue.avg} top={benchmarks.revenue.top} fmt={v => `$${v.toLocaleString()}`} />
        </div>
      </CollapsibleSection>

    </div>
  );
}