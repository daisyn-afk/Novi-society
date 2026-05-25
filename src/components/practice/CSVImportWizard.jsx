import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
  Users,
  Download,
  Mail
} from "lucide-react";
import { parseProviderPatientsCsv, importProviderPatients, inviteProviderPatients } from "@/api/providerPatientsApi.js";

const CSV_TEMPLATE =
  "email,first_name,last_name,phone,date_of_birth,gender\n" +
  "jane.doe@example.com,Jane,Doe,555-0100,1990-03-15,Female\n" +
  "john.smith@example.com,John,Smith,555-0200,1985-07-22,Male\n";

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "patient_import_template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SYSTEM_FIELDS = [
  { key: "email",         label: "Email",         required: true  },
  { key: "first_name",    label: "First Name",    required: false },
  { key: "last_name",     label: "Last Name",     required: false },
  { key: "phone",         label: "Phone",         required: false },
  { key: "date_of_birth", label: "Date of Birth", required: false },
  { key: "gender",        label: "Gender",        required: false }
];

const STEPS = ["Upload", "Map Columns", "Preview", "Summary"];

function autoSuggestMapping(headers) {
  const suggestions = {};
  for (const field of SYSTEM_FIELDS) {
    const match = headers.find(h => {
      const norm = h.toLowerCase().replace(/[\s_\-.]/g, "");
      const key  = field.key.replace(/_/g, "");
      if (norm === key) return true;
      if (field.key === "email"         && norm.includes("email"))                                    return true;
      if (field.key === "first_name"    && (norm.includes("first") || norm.includes("firstname")))    return true;
      if (field.key === "last_name"     && (norm.includes("last")  || norm.includes("lastname") || norm.includes("surname"))) return true;
      if (field.key === "phone"         && (norm.includes("phone") || norm.includes("mobile") || norm.includes("cell")))      return true;
      if (field.key === "date_of_birth" && (norm.includes("dob")   || norm.includes("birth")))        return true;
      if (field.key === "gender"        && norm.includes("gender"))                                   return true;
      return false;
    });
    if (match) suggestions[field.key] = match;
  }
  return suggestions;
}

const glass = {
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.85)",
  boxShadow: "0 2px 16px rgba(30,37,53,0.06)"
};

export default function CSVImportWizard({ open, onClose }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [step, setStep]             = useState(0);
  const [file, setFile]             = useState(null);
  const [parseResult, setParseResult] = useState(null); // { headers, rows, preview, totalRows }
  const [mapping, setMapping]       = useState({});
  const [summary, setSummary]       = useState(null);
  const [dragOver, setDragOver]     = useState(false);
  const [error, setError]           = useState("");
  const [importing, setImporting]   = useState(false);
  const [parsing, setParsing]       = useState(false);
  const [inviting, setInviting]     = useState(false);
  const [inviteResult, setInviteResult] = useState(null); // { invited, skipped, failed }

  const handleFileParse = useCallback(async (f) => {
    setError("");
    setFile(f);
    setParsing(true);
    try {
      const data = await parseProviderPatientsCsv(f);
      setParseResult(data);
      setMapping(autoSuggestMapping(data.headers));
      setStep(1);
    } catch (e) {
      setError(e.message || "Failed to parse file.");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileParse(f);
  }, [handleFileParse]);

  const handleImport = async () => {
    setError("");
    setImporting(true);
    try {
      const data = await importProviderPatients(parseResult.rows, mapping);
      setSummary(data);
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ["provider-patients"] });
    } catch (e) {
      setError(e.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleInvite = async () => {
    if (!summary?.batchId) return;
    setInviting(true);
    try {
      const result = await inviteProviderPatients(summary.batchId);
      setInviteResult(result);
    } catch {
      setInviteResult({ invited: 0, skipped: 0, failed: 0, errors: [] });
    } finally {
      setInviting(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setFile(null);
    setParseResult(null);
    setMapping({});
    setSummary(null);
    setError("");
    setInviteResult(null);
    onClose();
  };

  const isMappingValid = Boolean(mapping.email);

  // Apply current mapping to preview rows for the preview table
  const previewRows = (parseResult?.preview || []).map(raw => {
    const row = {};
    for (const f of SYSTEM_FIELDS) {
      row[f.key] = mapping[f.key] ? (raw[mapping[f.key]] || "") : "";
    }
    return row;
  });

  const isLoading = parsing || importing;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isLoading) handleClose(); }}>
      <DialogContent
        className="max-w-2xl w-full"
        style={{
          background: "rgba(245,247,250,0.97)",
          backdropFilter: "blur(24px)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.9)"
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ color: "#1e2535" }}>
            Import Patients from CSV
          </DialogTitle>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: i === step ? "rgba(250,111,48,0.12)" : i < step ? "rgba(45,158,78,0.1)" : "rgba(30,37,53,0.06)",
                    color:      i === step ? "#FA6F30"               : i < step ? "#2d9e4e"              : "rgba(30,37,53,0.35)"
                  }}
                >
                  {i < step
                    ? <CheckCircle2 className="w-3 h-3" />
                    : <span
                        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: i === step ? "#FA6F30" : "rgba(30,37,53,0.12)",
                          color:      i === step ? "white"   : "rgba(30,37,53,0.35)"
                        }}
                      >{i + 1}</span>
                  }
                  {label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-4 h-px" style={{ background: "rgba(30,37,53,0.12)" }} />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* ── Step 0: Upload ── */}
        {step === 0 && (
          <div className="space-y-4 py-2">
            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
              style={{
                ...glass,
                border: dragOver ? "2px dashed #FA6F30" : "2px dashed rgba(30,37,53,0.18)",
                background: dragOver ? "rgba(250,111,48,0.04)" : "rgba(255,255,255,0.4)"
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !parsing && fileInputRef.current?.click()}
            >
              {parsing
                ? <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#FA6F30" }} />
                : <Upload className="w-8 h-8" style={{ color: dragOver ? "#FA6F30" : "rgba(30,37,53,0.28)" }} />
              }
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
                {parsing ? "Parsing file…" : "Drop your CSV here or click to browse"}
              </p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.45)" }}>
                .csv files only · max 500 rows · 1 MB limit
              </p>
              {file && !parsing && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.2)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "#FA6F30" }} />
                  <span className="text-xs font-medium" style={{ color: "#FA6F30" }}>{file.name}</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileParse(f); }}
            />

            {error && (
              <div className="flex items-start gap-2 rounded-xl p-3"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
                Requires an <strong>Email</strong> column. Optional: First Name, Last Name, Phone, Date of Birth, Gender.
              </p>
              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-opacity hover:opacity-75"
                style={{ color: "#7B8EC8" }}
              >
                <Download className="w-3 h-3" />
                Download template
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Map Columns ── */}
        {step === 1 && parseResult && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{ background: "rgba(250,111,48,0.07)", border: "1px solid rgba(250,111,48,0.18)" }}>
              <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#FA6F30" }} />
              <p className="text-xs font-medium" style={{ color: "#1e2535" }}>
                <span style={{ color: "#FA6F30" }}>{parseResult.totalRows}</span> rows detected in{" "}
                <span className="font-semibold">{file?.name}</span>
              </p>
            </div>

            <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              Match your CSV column headers to the system fields below.{" "}
              <span style={{ color: "#ef4444" }}>*</span> = required.
            </p>

            <div className="space-y-2.5">
              {SYSTEM_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0">
                    <span className="text-xs font-semibold" style={{ color: "#1e2535" }}>
                      {field.label}
                      {field.required && <span style={{ color: "#ef4444" }}> *</span>}
                    </span>
                  </div>
                  <Select
                    value={mapping[field.key] || "__none__"}
                    onValueChange={(val) =>
                      setMapping(prev => ({ ...prev, [field.key]: val === "__none__" ? undefined : val }))
                    }
                  >
                    <SelectTrigger
                      className="flex-1 h-9 text-xs rounded-xl"
                      style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.9)" }}
                    >
                      <SelectValue placeholder="— skip this field —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— skip this field —</SelectItem>
                      {parseResult.headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!isMappingValid && (
              <div className="flex items-center gap-2 rounded-xl p-2.5"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#ef4444" }}>Map the Email field to continue.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
              Showing first {previewRows.length} of {parseResult?.totalRows} rows. Verify the mapping looks correct before importing.
            </p>

            <div className="overflow-auto rounded-xl" style={{ maxHeight: 280, ...glass }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {SYSTEM_FIELDS.filter(f => mapping[f.key]).map(f => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap px-3 py-2" style={{ color: "#1e2535" }}>
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => {
                    const missingEmail = !row.email;
                    return (
                      <TableRow key={i} style={missingEmail ? { background: "rgba(239,68,68,0.05)" } : {}}>
                        {SYSTEM_FIELDS.filter(f => mapping[f.key]).map(f => (
                          <TableCell key={f.key} className="text-xs px-3 py-2 max-w-[180px] truncate">
                            {f.key === "email" && missingEmail
                              ? <span className="flex items-center gap-1" style={{ color: "#ef4444" }}>
                                  <AlertCircle className="w-3 h-3" /> missing
                                </span>
                              : row[f.key] || <span style={{ color: "rgba(30,37,53,0.28)" }}>—</span>
                            }
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {parseResult?.totalRows > 10 && (
              <p className="text-xs text-center" style={{ color: "rgba(30,37,53,0.4)" }}>
                + {parseResult.totalRows - 10} more rows not shown
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl p-3"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Summary ── */}
        {step === 3 && summary && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total rows",          value: summary.totalRows, accent: "#1e2535" },
                { label: "Imported",            value: summary.imported,  accent: "#2d9e4e" },
                { label: "Skipped (existing)",  value: summary.skipped,   accent: "#FA6F30" },
                { label: "Failed",              value: summary.failed,    accent: summary.failed > 0 ? "#ef4444" : "#1e2535" }
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl p-4 text-center" style={glass}>
                  <p className="text-2xl font-bold" style={{ color: stat.accent }}>{stat.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {summary.imported > 0 && (
              <div className="flex items-center gap-2 rounded-xl p-3"
                style={{ background: "rgba(45,158,78,0.08)", border: "1px solid rgba(45,158,78,0.22)" }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#2d9e4e" }} />
                <p className="text-xs font-medium" style={{ color: "#2d9e4e" }}>
                  {summary.imported} patient{summary.imported !== 1 ? "s" : ""} successfully added to your practice.
                </p>
              </div>
            )}

            {/* Invite CTA — only show if patients were newly added */}
            {summary.imported > 0 && !inviteResult && (
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(123,142,200,0.07)", border: "1px solid rgba(123,142,200,0.22)" }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(123,142,200,0.15)" }}>
                    <Mail className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>
                      Invite patients to NOVI
                    </p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(30,37,53,0.55)" }}>
                      Send a one-time invite email to patients who don&apos;t have a NOVI account yet so they can
                      view aftercare plans and book future appointments.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={inviting}
                  onClick={handleInvite}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: "#7B8EC8", color: "white", border: "none" }}
                >
                  {inviting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending invites…</>
                    : <><Mail className="w-3.5 h-3.5" />Invite newly added patients</>
                  }
                </button>
              </div>
            )}

            {/* Invite result */}
            {inviteResult && (
              <div className="rounded-2xl p-4 space-y-1" style={{ background: "rgba(45,158,78,0.06)", border: "1px solid rgba(45,158,78,0.2)" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#2d9e4e" }} />
                  <p className="text-xs font-semibold" style={{ color: "#2d9e4e" }}>
                    Invite results: {inviteResult.invited} sent
                    {inviteResult.failed > 0 ? `, ${inviteResult.failed} failed` : ""}
                  </p>
                </div>
                <p className="text-xs pl-6" style={{ color: "rgba(30,37,53,0.5)" }}>
                  Patients already on NOVI were skipped automatically.
                </p>
              </div>
            )}

            {summary.errors?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                  Failed rows ({summary.errors.length})
                </p>
                <div className="rounded-xl overflow-auto" style={{ maxHeight: 160, ...glass }}>
                  {summary.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 border-b last:border-0"
                      style={{ borderColor: "rgba(30,37,53,0.07)" }}>
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                      <p className="text-xs" style={{ color: "rgba(30,37,53,0.7)" }}>
                        <span className="font-semibold">Row {err.row}</span>
                        {err.email ? ` · ${err.email}` : ""}
                        {" — "}{err.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center gap-2 mt-2">
          <div className="flex-1">
            {step > 0 && step < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setError(""); setStep(s => s - 1); }}
                disabled={isLoading}
                className="text-xs"
                style={{ color: "rgba(30,37,53,0.55)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={importing}
            className="text-xs"
            style={{ color: "rgba(30,37,53,0.55)" }}
          >
            {step === 3 ? "Close" : "Cancel"}
          </Button>

          {step === 1 && (
            <Button
              size="sm"
              disabled={!isMappingValid}
              onClick={() => setStep(2)}
              className="text-xs font-semibold rounded-xl"
              style={{ background: "#FA6F30", color: "white", border: "none" }}
            >
              Preview <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {step === 2 && (
            <Button
              size="sm"
              disabled={importing}
              onClick={handleImport}
              className="text-xs font-semibold rounded-xl"
              style={{ background: "#FA6F30", color: "white", border: "none" }}
            >
              {importing
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Importing…</>
                : <><Users className="w-3.5 h-3.5 mr-1.5" />Import {parseResult?.totalRows} Patient{parseResult?.totalRows !== 1 ? "s" : ""}</>
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
