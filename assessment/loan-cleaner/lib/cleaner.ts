export type Flag = { field: string; message: string };
export type Row = {
  rowNo: number; branch: string; customer_name: string;
  loan_amount: number | null; loan_date: string; phone: string; status: string;
  flags: Flag[]; reviewed: boolean;
};
type R = { v: any; f?: string };

// ---- Settings a different branch/vendor would change ----
const BRANCHES = ["Andheri", "Borivali", "Thane"];
const ALIASES: Record<string, string[]> = {
  branch: ["branch"], customer_name: ["customer", "name"],
  loan_amount: ["amt", "amount"], loan_date: ["date"],
  phone: ["phone", "mobile", "contact"], status: ["status"],
};
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

const s = (v: unknown) => (v == null ? "" : String(v)).trim();
const get = (r: Record<string, unknown>, key: string) => {
  const k = Object.keys(r).find((h) => ALIASES[key].some((a) => h.toLowerCase().includes(a)));
  return k ? s(r[k]) : "";
};

function cleanBranch(raw: string): R {
  const t = raw.toLowerCase().replace(/\./g, "").trim();
  const hit = BRANCHES.find((b) => t.startsWith(b.toLowerCase()));
  if (!hit) return { v: raw, f: raw ? `Branch "${raw}" is not one we know` : "Branch is missing" };
  const extra = t.slice(hit.length).trim();
  if (["", "br", "branch"].includes(extra)) return { v: hit };
  return { v: hit, f: `Written as "${raw}", we read it as ${hit}. Please confirm` };
}

function cleanAmount(raw: string): R {
  if (!raw) return { v: null, f: "Loan amount is missing" };
  let t = raw.toLowerCase().replace(/₹|rs\.?|,|\s/g, "");
  let mult = 1, k = false;
  if (t.endsWith("k")) { mult = 1000; t = t.slice(0, -1); k = true; }
  const n = Number(t);
  if (t === "" || isNaN(n)) return { v: null, f: `"${raw}" is not a number` };
  if (n <= 0) return { v: null, f: `Amount is ${n < 0 ? "negative" : "zero"} (${raw})` };
  const v = n * mult;
  return { v, f: k ? `Written as "${raw}", we read it as ${v.toLocaleString("en-IN")}. Please confirm` : undefined };
}

function toISO(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function cleanDate(raw: string, dayFirst: boolean): R {
  if (!raw) return { v: "", f: "Date is missing" };
  let y = 0, m = 0, d = 0, twoDigit = false, mt: RegExpMatchArray | null;
  if ((mt = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/))) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
  else if ((mt = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/))) {
    y = +mt[3]; if (mt[3].length === 2) { y += 2000; twoDigit = true; }
    if (dayFirst) { d = +mt[1]; m = +mt[2]; } else { m = +mt[1]; d = +mt[2]; }
  } else if ((mt = raw.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    m = MONTHS.indexOf(mt[1].toLowerCase().slice(0, 3)) + 1; d = +mt[2]; y = +mt[3];
  } else return { v: "", f: `Can't read the date "${raw}"` };
  const v = toISO(y, m, d);
  if (!v) return { v: "", f: `"${raw}" is not a real date` };
  if (new Date(v) > new Date()) return { v, f: "Date is in the future" };
  if (twoDigit) return { v, f: `Year written as 2 digits, we read it as ${y}` };
  return { v };
}

function cleanPhone(raw: string): R {
  if (!raw) return { v: "", f: "Phone number is missing" };
  if (/[a-z]/i.test(raw)) return { v: "", f: `Phone "${raw}" has letters in it` };
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length !== 10) return { v: "", f: `Phone "${raw}" doesn't have 10 digits` };
  return { v: d };
}

function cleanStatus(raw: string): R {
  const v = ({ active: "Active", closed: "Closed", npa: "NPA" } as Record<string, string>)[raw.toLowerCase().trim()];
  return v ? { v } : { v: "", f: raw ? `Status "${raw}" is not Active, Closed or NPA` : "Status is missing" };
}

// ---- duplicate checks ----
const norm = (n: string) => n.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
function lev(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return dp[a.length][b.length];
}
function similarName(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (lev(x, y) <= 2) return true;
  const [xf, ...xr] = x.split(" "), [yf, ...yr] = y.split(" ");
  return xr.length > 0 && xr.join(" ") === yr.join(" ") && xf[0] === yf[0]; // "R. Kumar" ~ "Ramesh Kumar"
}

export function cleanRegister(data: Record<string, unknown>[], dayFirst = true): Row[] {
  const rows: Row[] = data
    .map((r, i) => {
      const parts = {
        branch: cleanBranch(get(r, "branch")),
        customer_name: { v: get(r, "customer_name").replace(/\s+/g, " "), f: get(r, "customer_name") ? undefined : "Customer name is missing" } as R,
        loan_amount: cleanAmount(get(r, "loan_amount")),
        loan_date: cleanDate(get(r, "loan_date"), dayFirst),
        phone: cleanPhone(get(r, "phone")),
        status: cleanStatus(get(r, "status")),
      };
      const flags: Flag[] = Object.entries(parts).filter(([, p]) => p.f).map(([field, p]) => ({ field, message: p.f! }));
      return {
        rowNo: i + 2, // Excel row number (row 1 is the header)
        branch: parts.branch.v, customer_name: parts.customer_name.v, loan_amount: parts.loan_amount.v,
        loan_date: parts.loan_date.v, phone: parts.phone.v, status: parts.status.v, flags, reviewed: false,
      } as Row;
    })
    .filter((r) => r.branch || r.customer_name || r.loan_amount || r.phone); // skip blank lines

  // possible duplicates: similar name + same amount + same date
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.loan_amount && a.loan_amount === b.loan_amount && a.loan_date && a.loan_date === b.loan_date && similarName(a.customer_name, b.customer_name)) {
        a.flags.push({ field: "row", message: `Possible duplicate of row ${b.rowNo} (same amount and date, similar name)` });
        b.flags.push({ field: "row", message: `Possible duplicate of row ${a.rowNo} (same amount and date, similar name)` });
      }
    }
  // same phone on several rows
  const byPhone: Record<string, Row[]> = {};
  rows.forEach((r) => r.phone && (byPhone[r.phone] ||= []).push(r));
  Object.values(byPhone).filter((g) => g.length > 1).forEach((g) =>
    g.forEach((r) => r.flags.push({ field: "row", message: `Same phone as row ${g.filter((x) => x !== r).map((x) => x.rowNo).join(", ")}. Same person?` }))
  );
  return rows;
}