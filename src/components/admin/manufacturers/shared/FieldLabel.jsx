export default function FieldLabel({
  children,
  required = false,
  hint,
  className = "",
  htmlFor,
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-slate-700 block"
      >
        {children}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
      {hint ? <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p> : null}
    </div>
  );
}
