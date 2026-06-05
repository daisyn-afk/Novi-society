import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getFoundationPlaybook } from "@/data/foundationStepPlaybooks";
import { ExternalLink, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(30,37,53,0.08)", background: "rgba(30,37,53,0.02)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(30,37,53,0.45)" }}>
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.35)" }} />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

export default function FoundationStepPlaybook({
  step,
  accent = "#7B8EC8",
  isDone,
  onToggle,
}) {
  const navigate = useNavigate();
  const playbook = getFoundationPlaybook(step.playbook || step.id);
  if (!playbook) return null;

  const runPrimaryCta = () => {
    const cta = playbook.primaryCta;
    if (!cta) {
      if (playbook.externalUrl) window.open(playbook.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (cta.type === "internal" && cta.navigate_to) {
      navigate(createPageUrl(cta.navigate_to) + (cta.navigate_params || ""));
      return;
    }
    if (cta.url) window.open(cta.url, "_blank", "noopener,noreferrer");
  };

  const runSecondaryCta = () => {
    const cta = playbook.secondaryCta;
    if (!cta) return;
    if (cta.type === "internal" && cta.navigate_to) {
      navigate(createPageUrl(cta.navigate_to) + (cta.navigate_params || ""));
      return;
    }
    if (cta.url) window.open(cta.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-4 space-y-3">
      {playbook.outcome && (
        <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
          <span className="font-semibold" style={{ color: "#1e2535" }}>
            Outcome:{" "}
          </span>
          {playbook.outcome}
        </p>
      )}

      {(playbook.vendorName || playbook.vendorLabel) && (
        <div className="text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
          {playbook.vendorLabel && (
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(30,37,53,0.4)" }}>
              {playbook.vendorLabel}
            </p>
          )}
          <p className="font-medium" style={{ color: "#1e2535" }}>
            {playbook.vendorName}
          </p>
        </div>
      )}

      {playbook.providerSteps?.length > 0 && (
        <Section title="Provider steps" defaultOpen>
          <ol className="space-y-2 list-none">
            {playbook.providerSteps.map((ps, i) => (
              <li key={i} className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>
                <span className="font-semibold" style={{ color: "#1e2535" }}>
                  {ps.title}
                </span>
                {ps.body ? ` — ${ps.body}` : ""}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {playbook.infoLists?.map((list) =>
        list.items?.length ? (
          <Section key={list.title} title={list.title} defaultOpen={list.defaultOpen ?? false}>
            <ul className="space-y-1 text-sm list-disc pl-4" style={{ color: "rgba(30,37,53,0.65)" }}>
              {list.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>
        ) : null
      )}

      {playbook.categories?.length > 0 && (
        <Section title="Marketplace categories" defaultOpen={false}>
          <div className="space-y-3">
            {playbook.categories.map((cat) => (
              <div key={cat.group}>
                <p className="text-xs font-bold mb-1" style={{ color: "rgba(30,37,53,0.5)" }}>
                  {cat.group}
                </p>
                <ul className="text-sm list-disc pl-4" style={{ color: "rgba(30,37,53,0.6)" }}>
                  {cat.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {playbook.npInstructions?.length > 0 && (
        <Section title="Nurse practitioners" defaultOpen={false}>
          <ul className="space-y-1 text-sm list-disc pl-4" style={{ color: "rgba(30,37,53,0.65)" }}>
            {playbook.npInstructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>
      )}

      {playbook.importantNotes?.length > 0 && (
        <Section title="Important notes" defaultOpen={false}>
          <ul className="space-y-1 text-sm list-disc pl-4" style={{ color: "rgba(30,37,53,0.65)" }}>
            {playbook.importantNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      {playbook.whatHappensNext && (
        <Section title="What happens next" defaultOpen={false}>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
            {playbook.whatHappensNext}
          </p>
        </Section>
      )}

      {playbook.whyItMatters && (
        <p className="text-xs leading-relaxed px-3 py-2 rounded-lg" style={{ background: "rgba(250,111,48,0.08)", color: "rgba(30,37,53,0.55)" }}>
          <span className="font-bold">Why this matters: </span>
          {playbook.whyItMatters}
        </p>
      )}

      {playbook.noviNote && (
        <p className="text-xs leading-relaxed px-3 py-2 rounded-lg" style={{ background: "rgba(200,230,60,0.15)", color: "#3d5615" }}>
          <span className="font-bold">NOVI tip: </span>
          {playbook.noviNote}
        </p>
      )}

      {(playbook.requiredDocuments?.length > 0 || playbook.recommendedDocuments?.length > 0) && (
        <Section title="Documents" defaultOpen={false}>
          {playbook.requiredDocuments?.length > 0 && (
            <>
              <p className="text-xs font-bold mb-1" style={{ color: "rgba(30,37,53,0.45)" }}>
                Required
              </p>
              <ul className="text-sm list-disc pl-4 mb-2" style={{ color: "rgba(30,37,53,0.6)" }}>
                {playbook.requiredDocuments.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}
          {playbook.recommendedDocuments?.length > 0 && (
            <>
              <p className="text-xs font-bold mb-1" style={{ color: "rgba(30,37,53,0.45)" }}>
                Recommended to save
              </p>
              <ul className="text-sm list-disc pl-4" style={{ color: "rgba(30,37,53,0.6)" }}>
                {playbook.recommendedDocuments.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {playbook.resources?.length > 0 && (
        <Section title="Resources" defaultOpen={false}>
          <div className="space-y-2">
            {playbook.resources.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
                style={{ color: accent }}
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                {r.label}
              </a>
            ))}
          </div>
        </Section>
      )}

      {playbook.contacts?.length > 0 && (
        <Section title="Coverage questions" defaultOpen={false}>
          {playbook.contacts.map((c) => (
            <div key={c.email} className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>
              <p className="font-semibold" style={{ color: "#1e2535" }}>
                {c.name}
              </p>
              {c.email && (
                <a href={`mailto:${c.email}`} className="underline" style={{ color: accent }}>
                  {c.email}
                </a>
              )}
              {c.phone && <p>{c.phone}</p>}
            </div>
          ))}
        </Section>
      )}

      {!isDone && (playbook.primaryCta || playbook.externalUrl) && (
        <button
          type="button"
          onClick={runPrimaryCta}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${accent}, #2d3d66)`, color: "#fff" }}
        >
          {playbook.ctaLabel || playbook.primaryCta?.label || "Continue"}
          <ExternalLink className="w-4 h-4" />
        </button>
      )}

      {!isDone && playbook.secondaryCta && (
        <button
          type="button"
          onClick={runSecondaryCta}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-all hover:bg-slate-50"
          style={{ borderColor: "rgba(30,37,53,0.12)", color: "rgba(30,37,53,0.65)" }}
        >
          {playbook.secondaryCta.label}
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}

      {playbook.futureStatusSource && !isDone && (
        <p className="text-[10px] text-center" style={{ color: "rgba(30,37,53,0.35)" }}>
          Partner status sync ({playbook.futureStatusSource}) — update your progress above for now.
        </p>
      )}

      {!isDone && playbook.allowMarkDone && (
        <button
          type="button"
          onClick={() => onToggle(step.id)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-slate-50"
          style={{
            background: "#fff",
            border: "1.5px solid rgba(30,37,53,0.12)",
            color: "rgba(30,37,53,0.55)",
          }}
        >
          Mark step complete <CheckCircle2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
