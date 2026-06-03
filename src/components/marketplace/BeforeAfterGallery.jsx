/** Patient-facing before/after rows — complete pairs only, compact professional layout. */

function GalleryImage({ src, label, compact }) {
  const boxClass = compact
    ? "relative flex-1 min-w-0 h-40 sm:h-44 rounded-lg overflow-hidden border border-slate-200/90 shadow-sm bg-slate-100"
    : "relative flex-1 min-w-0 h-52 sm:h-56 rounded-xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-100";

  const labelClass = compact
    ? "text-[10px] px-2 py-1.5"
    : "text-xs px-2.5 py-2";

  return (
    <figure className={boxClass}>
      <img
        src={src}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover object-center"
        loading="lazy"
      />
      <figcaption
        className={`absolute inset-x-0 bottom-0 font-semibold uppercase tracking-wide text-white bg-gradient-to-t from-black/60 via-black/30 to-transparent ${labelClass}`}
      >
        {label}
      </figcaption>
    </figure>
  );
}

function PairRow({ pair, compact }) {
  return (
    <div className={`min-w-0 w-full ${compact ? "space-y-1.5" : "space-y-2"}`}>
      <div className={`flex gap-2 min-w-0 w-full ${compact ? "sm:gap-2.5" : "sm:gap-3"}`}>
        <GalleryImage src={pair.before_url} label="Before" compact={compact} />
        <GalleryImage src={pair.after_url} label="After" compact={compact} />
      </div>
      {pair.caption && (
        <p className={`text-slate-500 truncate ${compact ? "text-xs" : "text-sm"}`}>{pair.caption}</p>
      )}
    </div>
  );
}

/** @param {{ pairs: Array<{ before_url: string, after_url: string, caption?: string }>, variant?: 'card' | 'profile', maxSets?: number }} */
export function BeforeAfterGallery({ pairs, variant = "card", maxSets }) {
  const complete = (pairs || []).filter((p) => p.before_url && p.after_url);
  if (!complete.length) return null;

  const shown = maxSets != null ? complete.slice(0, maxSets) : complete;
  const compact = variant === "card";

  return (
    <div className={`min-w-0 w-full overflow-hidden ${compact ? "space-y-3" : "space-y-4"}`}>
      {shown.map((pair, i) => (
        <PairRow key={i} pair={pair} compact={compact} />
      ))}
      {maxSets != null && complete.length > maxSets && (
        <p className={`text-slate-400 ${compact ? "text-[10px]" : "text-xs"}`}>
          +{complete.length - maxSets} more set{complete.length - maxSets !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
