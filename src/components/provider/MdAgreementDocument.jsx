import { useMemo } from "react";
import {
  buildMdAgreementValues,
  buildMdAgreementBlocks,
  buildMdSignatureBlocks,
  parseAgreementSegments,
} from "@/lib/mdAgreementTemplate";

/** Render marked text, bolding dynamic (filled-in) values. */
function RichText({ text, caps }) {
  return parseAgreementSegments(text).map((seg, i) =>
    seg.dynamic ? (
      <strong key={i} className={`font-bold text-slate-900 ${caps ? "uppercase" : ""}`}>
        {seg.text}
      </strong>
    ) : (
      <span key={i} className={caps ? "uppercase" : ""}>
        {seg.text}
      </span>
    )
  );
}

const DOCTOR_SIGNATURE_SRC = "/assets/doctor-signature.png";

/**
 * Renders the code-defined Management Services Agreement (review + signature
 * page) as HTML. Dynamic tokens are filled from `context`; the provider's drawn
 * signature (left) and Dr. Hill's default signature (right) are placed into the
 * signature-page blocks.
 */
export default function MdAgreementDocument({
  context,
  providerSignatureUrl = "",
  doctorSignatureUrl = DOCTOR_SIGNATURE_SRC,
}) {
  const values = useMemo(
    () =>
      buildMdAgreementValues({
        providerName: context?.providerName,
        practiceName: context?.practiceName,
        state: context?.state,
        address: context?.address,
        serviceName: context?.serviceName,
        effectiveDate: context?.effectiveDate,
      }),
    [context]
  );
  const blocks = useMemo(() => buildMdAgreementBlocks(values), [values]);
  const sig = useMemo(() => buildMdSignatureBlocks(values), [values]);

  return (
    <div
      className="text-slate-600 break-words"
      style={{ fontSize: 13, lineHeight: 1.65, overflowWrap: "anywhere" }}
    >
      {blocks.map((block, i) => {
        if (block.type === "title") {
          return (
            <h2
              key={i}
              className="text-center font-bold text-slate-900 uppercase"
              style={{ fontSize: 14, margin: "2px 0 16px", letterSpacing: "0.04em" }}
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "heading") {
          return (
            <h3
              key={i}
              className="font-bold text-slate-900 uppercase"
              style={{ fontSize: 12.5, margin: "18px 0 7px", letterSpacing: "0.03em" }}
            >
              {block.text}
            </h3>
          );
        }
        if (block.type === "clause") {
          return (
            <p key={i} style={{ margin: "0 0 10px" }}>
              <span className="font-bold text-slate-900">{block.label} </span>
              <RichText text={block.text} caps={block.caps} />
            </p>
          );
        }
        return (
          <p key={i} style={{ margin: "0 0 10px" }}>
            <RichText text={block.text} caps={block.caps} />
          </p>
        );
      })}

      {/* Signature page */}
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
        <p className="text-center font-bold text-slate-900 uppercase tracking-wide" style={{ fontSize: 12 }}>
          Signature Page
        </p>
        <p style={{ margin: "12px 0 18px", textAlign: "center" }}><RichText text={sig.intro} /></p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 min-w-0">
          <SignatureBlock block={sig.left} signatureUrl={providerSignatureUrl} placeholder="Provider signs below" dynamic />
          <SignatureBlock block={sig.right} signatureUrl={doctorSignatureUrl} />
        </div>
      </div>
    </div>
  );
}

function SignatureBlock({ block, signatureUrl, placeholder, dynamic }) {
  const valueClass = dynamic ? "font-bold text-slate-900" : "text-slate-700";
  return (
    <div className="min-w-0">
      <p className="font-bold text-slate-900 uppercase tracking-wide" style={{ fontSize: 10.5, letterSpacing: "0.06em" }}>
        {block.role}
      </p>
      <p className={dynamic ? "font-bold text-slate-900" : "font-semibold text-slate-900"} style={{ marginTop: 8, fontSize: 12.5 }}>
        {block.entity}
      </p>
      <p className="text-slate-500" style={{ fontSize: 11.5 }}>{block.entityType}</p>

      <div
        className="flex items-end"
        style={{ height: 46, borderBottom: "1px solid #475569", marginTop: 18, marginBottom: 4 }}
      >
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt={`${block.name} signature`}
            style={{ maxHeight: 42, maxWidth: "100%", objectFit: "contain" }}
          />
        ) : (
          <span className="text-slate-300" style={{ fontSize: 11, paddingBottom: 4 }}>
            {placeholder || ""}
          </span>
        )}
      </div>

      <p className="text-slate-700" style={{ fontSize: 11.5, marginTop: 4 }}>
        Name: <span className={valueClass}>{block.name}</span>
      </p>
      <p className="text-slate-700" style={{ fontSize: 11.5 }}>Title: {block.title}</p>
    </div>
  );
}
