import { useRef, useState } from "react";
import { Upload, CheckCircle, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { parseMdStateLicenseFile } from "@/lib/mdStateLicenseFile";
import {
  US_STATES,
  createEmptyStateLicenseRow,
  firstAvailableState,
  licensedStatesFromRows,
  rowsFromImportedEntries,
  selectableStates,
} from "@/lib/mdStateLicenses";

export {
  US_STATES,
  createEmptyStateLicenseRow,
  licensedStatesFromRows,
  rowsFromImportedEntries,
  stateLicensesFromProfile,
  stateLicensesToPayload,
} from "@/lib/mdStateLicenses";

export default function MDStateLicensesSection({
  stateLicenseRows,
  onChange,
  nationwide,
  onNationwideChange,
  onNpiDetected,
  error,
}) {
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);
  const filledCount = licensedStatesFromRows(stateLicenseRows).length;

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const result = await parseMdStateLicenseFile(file);
      if (!result.entries.length) {
        setImportStatus({
          type: "error",
          message: result.warnings[0] || "Could not find any license rows in that file.",
        });
        return;
      }

      onChange(rowsFromImportedEntries(result.entries));
      if (result.npi && onNpiDetected) onNpiDetected(result.npi);
      if (onNationwideChange) onNationwideChange(false);

      const label = /\.xlsx?$/i.test(file.name) ? "Excel" : "CSV";
      const npiNote = result.npi ? " NPI was filled in too." : "";
      setImportStatus({
        type: "success",
        message: `Imported ${result.importedCount} state${result.importedCount === 1 ? "" : "s"} from ${label}.${npiNote}`,
      });
    } catch (err) {
      setImportStatus({
        type: "error",
        message: String(err?.message || "Could not read that file."),
      });
    }
  }

  function updateRow(rowId, field, value) {
    onChange(stateLicenseRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    const next = createEmptyStateLicenseRow();
    next.us_state = firstAvailableState(stateLicenseRows);
    onChange([...stateLicenseRows, next]);
  }

  function removeRow(rowId) {
    const next = stateLicenseRows.filter((row) => row.id !== rowId);
    onChange(next.length ? next : [createEmptyStateLicenseRow()]);
  }

  const visibleRows = stateLicenseRows.length ? stateLicenseRows : [createEmptyStateLicenseRow()];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500" style={{ lineHeight: 1.6 }}>
        Upload a CSV/XLSX clinic sheet to import every row in the same order and format as your file
        (including blank or &quot;-&quot; entries). Columns: State, State license, Exp date.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-xs font-semibold"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Upload CSV/XLSX
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-xs font-semibold"
          onClick={addRow}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add state
        </Button>
        <span className="text-[11px] text-slate-500">
          Accepts .xlsx clinic sheets directly, plus CSV. Optional NPI row supported.
        </span>
      </div>

      {importStatus && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            importStatus.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {importStatus.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[5.5rem_1fr_9.5rem_2rem] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
          <span>State</span>
          <span>State license</span>
          <span>Exp date</span>
          <span />
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {visibleRows.map((row) => {
            const options = selectableStates(visibleRows, row.id, row.us_state);
            const hasValue = Boolean(String(row.license_number ?? "").trim() || String(row.expiration_date ?? "").trim());
            return (
              <div
                key={row.id}
                className="grid grid-cols-[5.5rem_1fr_9.5rem_2rem] gap-2 px-3 py-1.5 items-center"
                style={{ background: hasValue ? "rgba(45,107,127,0.04)" : "transparent" }}
              >
                <select
                  value={row.us_state || ""}
                  onChange={(e) => updateRow(row.id, "us_state", e.target.value)}
                  className="h-8 text-xs rounded-md border border-slate-200 bg-white text-slate-900 px-2"
                >
                  <option value="">Select</option>
                  {options.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <Input
                  value={row.license_number}
                  onChange={(e) => updateRow(row.id, "license_number", e.target.value)}
                  placeholder="License number"
                  className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                />
                <Input
                  type="text"
                  value={row.expiration_date ?? ""}
                  onChange={(e) => updateRow(row.id, "expiration_date", e.target.value)}
                  placeholder="mm/dd/yyyy"
                  className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Remove state row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {filledCount} state{filledCount === 1 ? "" : "s"} with license details entered.
      </p>

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-xs font-semibold text-slate-700">Supervision coverage</p>
        <p className="text-xs text-slate-500" style={{ lineHeight: 1.6 }}>
          Choose Nationwide or add state licenses below. Until one is configured, providers in any state
          cannot be assigned to you for supervision.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={nationwide}
            onCheckedChange={(checked) => onNationwideChange(Boolean(checked))}
          />
          <span className="text-sm text-slate-800 font-medium">Nationwide (all states)</span>
        </label>
        {!nationwide && (
          <p className="text-xs text-slate-500">
            Limited to {filledCount || "no"} state{filledCount === 1 ? "" : "s"} with a license number above.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
