"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { cleanRegister, Row } from "../lib/cleaners";
import { Fragment } from "react";

const COLS = ["branch", "customer_name", "loan_amount", "loan_date", "phone", "status"] as const;
const LABEL = { branch: "Branch", customer_name: "Customer", loan_amount: "Amount (₹)", loan_date: "Date", phone: "Phone", status: "Status" };

export default function Home() {
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [dayFirst, setDayFirst] = useState(true);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const wb = XLSX.read(await f.arrayBuffer());
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    setRaw(data); setRows(cleanRegister(data, dayFirst));
  }
  const update = (rowNo: number, patch: object) => setRows((rs) => rs.map((r) => (r.rowNo === rowNo ? { ...r, ...patch } : r)));
  const edit = (r: Row, field: string, val: string) =>
    update(r.rowNo, { [field]: field === "loan_amount" ? Number(val) || null : val, flags: r.flags.filter((f) => f.field !== field) });

  const ok = (r: Row) => r.flags.length === 0 || r.reviewed;
  const good = rows.filter(ok), bad = rows.filter((r) => !ok(r));

  function download() {
    const clean = good.map((r) => Object.fromEntries(COLS.map((c) => [c, r[c]])));
    const review = bad.map((r) => ({ excel_row: r.rowNo, ...Object.fromEntries(COLS.map((c) => [c, r[c]])), why: r.flags.map((f) => f.message).join("; ") }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean), "Clean");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(review), "Needs review");
    XLSX.writeFile(wb, "clean_loan_register.xlsx");
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">Loan Register Cleaner</h1>
      <div className="flex gap-4 items-center">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
        <label className="text-sm">
          <input type="checkbox" checked={dayFirst} onChange={(e) => { setDayFirst(e.target.checked); setRows(cleanRegister(raw, e.target.checked)); }} />{" "}
          Dates are written day/month/year
        </label>
      </div>

      {rows.length > 0 && (<>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded bg-gray-100">{rows.length}<br /><small>rows read</small></div>
          <div className="p-3 rounded bg-green-100">{good.length}<br /><small>look fine</small></div>
          <div className="p-3 rounded bg-amber-100">{bad.length}<br /><small>need your check</small></div>
        </div>

        <table className="w-full text-sm">
          <thead><tr><th>#</th>{COLS.map((c) => <th key={c} className="text-left">{LABEL[c]}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.rowNo}>
                <tr key={r.rowNo} className={ok(r) ? "" : "bg-amber-50"}>
                  <td>{r.rowNo}</td>
                  {COLS.map((c) => (
                    <td key={c}>
                      <input value={r[c] ?? ""} onChange={(e) => edit(r, c, e.target.value)}
                        className={`w-full border rounded px-1 ${r.flags.some((f) => f.field === c) && !r.reviewed ? "border-red-400 bg-red-50" : "border-transparent"}`} />
                    </td>
                  ))}
                </tr>
                {!ok(r) && (
                  <tr key={r.rowNo + "w"} className="bg-amber-50">
                    <td colSpan={7} className="pb-2 text-amber-800">
                      {r.flags.map((f, i) => <div key={i}>⚠ {f.message}</div>)}
                      <button className="mt-1 px-2 py-0.5 rounded bg-green-600 text-white" onClick={() => update(r.rowNo, { reviewed: true })}>
                        ✓ It's fine, keep it
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <button onClick={download} className="px-4 py-2 rounded bg-blue-600 text-white">Download cleaned file</button>
      </>)}
    </main>
  );
}