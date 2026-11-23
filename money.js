// Pure money math. All amounts are integer cents. No DOM here.

// Split `cents` over n people; leftover cents go to the first people.
export function splitCents(cents, n) {
  if (n <= 0) return [];
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// Per-person price of an optional item (cents). Per-person field wins; else total / headcount rounded up.
export function optionalPerPerson(item) {
  if (item.per > 0) return item.per;
  if (item.total > 0 && item.headcount > 0) return Math.ceil(item.total / item.headcount);
  return 0;
}

// Who pays what for one item: [{name, cents}]. `joined` = names who opted in (optional items).
export function itemShares(item, joined = []) {
  if (!item.optional) {
    const s = splitCents(item.amount || 0, item.participants.length);
    return item.participants.map((name, i) => ({ name, cents: s[i] }));
  }
  const per = optionalPerPerson(item);
  return item.participants.filter((n) => joined.includes(n)).map((name) => ({ name, cents: per }));
}

// Everyone pays the organizer their full share (even items they fronted).
// The organizer then pays each fronter the full amount of the shares collected for that item.
export function compute(bill, optins = {}) {
  const owes = {}; // name -> {total, lines:[{item, cents}]}
  bill.people.forEach((p) => (owes[p] = { total: 0, lines: [] }));
  const fronted = {}; // payer -> cents, only payers other than the organizer
  bill.items.forEach((item, idx) => {
    const shares = itemShares(item, optins[idx] || []);
    let sum = 0;
    shares.forEach(({ name, cents }) => {
      if (!owes[name]) return;
      owes[name].total += cents;
      owes[name].lines.push({ item: item.name, cents });
      sum += cents;
    });
    if (item.paidBy && item.paidBy !== bill.organizer && sum > 0) {
      fronted[item.paidBy] = (fronted[item.paidBy] || 0) + sum;
    }
  });
  const collects = Object.entries(owes)
    .filter(([n]) => n !== bill.organizer)
    .reduce((a, [, v]) => a + v.total, 0);
  const paysOut = Object.values(fronted).reduce((a, b) => a + b, 0);
  return { owes, fronted, collects, paysOut, organizerCost: owes[bill.organizer]?.total || 0 };
}

export function fmt(cents) {
  return (cents / 100).toFixed(2);
}

// "10.28", "10", "7" style used in chat summaries.
export function fmtShort(cents) {
  return cents % 100 === 0 ? String(cents / 100) : fmt(cents);
}

export function summaryLine(name, organizer, lines, total) {
  const parts = lines.map((l) => `${l.item.toLowerCase().replace(/\s+/g, '')} ${fmtShort(l.cents)}`);
  return `${name}: Zelle ${organizer} $${fmt(total)} (${parts.join(', ')})`;
}

export function toCents(str) {
  const n = parseFloat(String(str).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
