// ===== Edit these =====
const DEFAULT_PEOPLE = ['Sarah', 'Derek', 'Megan', 'Rita', 'Trav', 'Yining', 'Ball', 'Annie'];
const DEFAULT_ORGANIZER = 'Sarah';
// ======================

import { compute, itemShares, optionalPerPerson, fmt, summaryLine, toCents } from './money.js';

const app = document.getElementById('app');
const $ = (s) => app.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let draft = newDraft();
let view = { mode: 'create', bill: null, me: '', joined: [] };

function newDraft() {
  return {
    organizer: DEFAULT_ORGANIZER,
    roster: DEFAULT_PEOPLE.map((name) => ({ name, on: true, guest: false })),
    items: [newItem(DEFAULT_PEOPLE)],
  };
}
function active() { return draft.roster.filter((p) => p.on).map((p) => p.name); }
function newItem(people) {
  return { name: '', optional: false, amount: '', per: '', total: '', headcount: '', participants: (people || active()).slice(), paidBy: '' };
}

// ---------- links ----------
function encode(bill, mode) {
  const b = mode === 's' ? { ...bill, optins: {} } : bill;
  return LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, m: mode, b }));
}
function decode(hash) {
  try {
    const o = JSON.parse(LZString.decompressFromEncodedURIComponent(hash));
    if (o && o.b && Array.isArray(o.b.people) && Array.isArray(o.b.items)) return o;
  } catch (e) { /* fall through */ }
  return null;
}
const linkFor = (bill, mode) => location.origin + location.pathname + '#' + encode(bill, mode);

function buildBill() {
  const people = active();
  const organizer = people.includes(draft.organizer) ? draft.organizer : people[0];
  const items = draft.items
    .filter((it) => it.name.trim())
    .map((it) => ({
      name: it.name.trim(),
      optional: it.optional,
      amount: toCents(it.amount),
      per: toCents(it.per),
      total: toCents(it.total),
      headcount: parseInt(it.headcount, 10) || 0,
      participants: it.participants.filter((p) => people.includes(p)),
      paidBy: people.includes(it.paidBy) ? it.paidBy : organizer,
    }));
  return { organizer, people, items, optins: {} };
}

function draftFromBill(bill) {
  const roster = DEFAULT_PEOPLE.map((name) => ({ name, on: bill.people.includes(name), guest: false }));
  bill.people.filter((n) => !DEFAULT_PEOPLE.includes(n)).forEach((name) => roster.push({ name, on: true, guest: true }));
  const d = (c) => (c ? (c / 100).toFixed(2) : '');
  return {
    organizer: bill.organizer,
    roster,
    items: bill.items.map((it) => ({
      name: it.name, optional: !!it.optional, amount: d(it.amount), per: d(it.per), total: d(it.total),
      headcount: it.headcount || '', participants: it.participants.slice(), paidBy: it.paidBy,
    })),
  };
}

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
    t.remove();
  }
  if (btn) { const old = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => (btn.textContent = old), 1200); }
}

// ---------- routing ----------
function route() {
  const hash = location.hash.slice(1);
  if (!hash) { view = { mode: 'create' }; return render(); }
  const o = decode(hash);
  if (!o) { view = { mode: 'create' }; return render(); }
  view = { mode: o.m === 'o' ? 'organizer' : 'friend', bill: o.b, me: view.me || '', joined: view.joined || [] };
  if (view.mode === 'organizer') view.bill.optins = view.bill.optins || {};
  render();
}
window.addEventListener('hashchange', route);

function render() {
  if (view.mode === 'create') renderCreate();
  else if (view.mode === 'friend') renderFriend();
  else renderOrganizer();
}

// ---------- create view ----------
function itemHtml(it, i) {
  const people = active();
  const perTxt = it.optional ? `Per person: <b id="pp${i}">$${fmt(optionalPerPerson({ per: toCents(it.per), total: toCents(it.total), headcount: parseInt(it.headcount, 10) || 0 }))}</b>` : '';
  return `<div class="card" data-i="${i}">
    <div class="row"><div><label>Item name</label><input type="text" data-f="name" value="${esc(it.name)}" placeholder="Hotpot"></div>
    <div style="flex:0 0 auto;align-self:flex-end"><button class="danger" data-act="delitem">Remove</button></div></div>
    <label class="inline"><input type="checkbox" data-f="optional" ${it.optional ? 'checked' : ''}> Optional (people opt in)</label>
    ${it.optional
      ? `<div class="row"><div><label>Per-person price ($)</label><input type="number" inputmode="decimal" step="0.01" data-f="per" value="${esc(it.per)}"></div>
         <div><label>or Total ($)</label><input type="number" inputmode="decimal" step="0.01" data-f="total" value="${esc(it.total)}"></div>
         <div><label>÷ Headcount</label><input type="number" inputmode="numeric" data-f="headcount" value="${esc(it.headcount)}"></div></div>
         <div class="mute" style="margin-top:6px">Per-person price wins if filled. ${perTxt}</div>`
      : `<label>Total amount ($)</label><input type="number" inputmode="decimal" step="0.01" data-f="amount" value="${esc(it.amount)}">`}
    <label>Paid by (fronted the money)</label>
    <select data-f="paidBy">${people.map((p) => `<option ${((it.paidBy || draft.organizer) === p) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
    <label>${it.optional ? 'Eligible people' : 'Split between'}</label>
    <div class="chips">${people.map((p) => `<label class="chip"><input type="checkbox" data-part="${esc(p)}" ${it.participants.includes(p) ? 'checked' : ''}>${esc(p)}</label>`).join('')}</div>
  </div>`;
}

function renderCreate() {
  const people = active();
  app.innerHTML = `<h1>Yabi Split Bill</h1>
  <div class="card"><label>Organizer (everyone pays them)</label>
    <select id="org">${people.map((p) => `<option ${p === draft.organizer ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
    <label>People</label>
    <div class="chips">${draft.roster.map((p, i) => `<label class="chip"><input type="checkbox" data-ri="${i}" ${p.on ? 'checked' : ''}>${esc(p.name)}${p.guest ? ` <button class="danger" data-act="delguest" data-ri="${i}" title="Remove guest">✕</button>` : ''}</label>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input type="text" id="guest" placeholder="Guest name"><button id="addguest" style="flex:0 0 auto">Add person</button></div>
  </div>
  ${draft.items.map(itemHtml).join('')}
  <div class="actions"><button id="additem">+ Add item</button></div>
  <div class="actions"><button class="primary" id="cshare">Copy share link</button><button id="corg">Copy organizer link</button><button id="preview">Preview</button></div>
  <div class="mute" id="msg"></div>`;
}

app.addEventListener('input', (e) => {
  if (view.mode !== 'create') return;
  const card = e.target.closest('[data-i]');
  if (!card || !e.target.dataset.f) return;
  const i = +card.dataset.i, f = e.target.dataset.f, it = draft.items[i];
  if (f === 'optional') return;
  it[f] = e.target.value;
  if (it.optional) {
    const pp = $('#pp' + i);
    if (pp) pp.textContent = '$' + fmt(optionalPerPerson({ per: toCents(it.per), total: toCents(it.total), headcount: parseInt(it.headcount, 10) || 0 }));
  }
});

app.addEventListener('change', (e) => {
  const t = e.target;
  if (view.mode === 'create') {
    if (t.id === 'org') { draft.organizer = t.value; draft.items.forEach((it) => { if (!it.paidBy) it.paidBy = ''; }); return; }
    if (t.dataset.ri !== undefined && t.type === 'checkbox') {
      const p = draft.roster[+t.dataset.ri]; p.on = t.checked;
      draft.items.forEach((it) => {
        if (t.checked && !it.participants.includes(p.name)) it.participants.push(p.name);
        if (!t.checked) { it.participants = it.participants.filter((n) => n !== p.name); if (it.paidBy === p.name) it.paidBy = ''; }
      });
      if (!t.checked && draft.organizer === p.name) draft.organizer = active()[0];
      return renderCreate();
    }
    const card = t.closest('[data-i]');
    if (!card) return;
    const it = draft.items[+card.dataset.i];
    if (t.dataset.f === 'optional') { it.optional = t.checked; return renderCreate(); }
    if (t.dataset.f === 'paidBy') it.paidBy = t.value;
    if (t.dataset.part !== undefined) {
      const n = t.dataset.part;
      it.participants = t.checked ? [...it.participants, n] : it.participants.filter((x) => x !== n);
    }
  } else if (view.mode === 'friend') {
    if (t.id === 'me') { view.me = t.value; view.joined = []; renderFriend(); }
    if (t.dataset.join !== undefined) {
      const i = +t.dataset.join;
      view.joined = t.checked ? [...view.joined, i] : view.joined.filter((x) => x !== i);
      renderFriend();
    }
  } else if (view.mode === 'organizer') {
    if (t.dataset.opt !== undefined) {
      const [i, name] = [t.dataset.opt, t.dataset.name];
      const cur = view.bill.optins[i] || [];
      view.bill.optins[i] = t.checked ? [...cur, name] : cur.filter((x) => x !== name);
      history.replaceState(null, '', '#' + encode(view.bill, 'o'));
      renderOrganizer();
    }
  }
});

app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (view.mode === 'create') {
    if (t.id === 'addguest') {
      const inp = $('#guest'); const name = inp.value.trim();
      if (!name || draft.roster.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
      draft.roster.push({ name, on: true, guest: true });
      draft.items.forEach((it) => it.participants.push(name));
      return renderCreate();
    }
    if (t.dataset.act === 'delguest') {
      e.preventDefault();
      const p = draft.roster[+t.dataset.ri];
      draft.roster.splice(+t.dataset.ri, 1);
      draft.items.forEach((it) => { it.participants = it.participants.filter((n) => n !== p.name); if (it.paidBy === p.name) it.paidBy = ''; });
      if (draft.organizer === p.name) draft.organizer = active()[0];
      return renderCreate();
    }
    if (t.id === 'additem') { draft.items.push(newItem()); return renderCreate(); }
    if (t.dataset.act === 'delitem') { draft.items.splice(+t.closest('[data-i]').dataset.i, 1); return renderCreate(); }
    if (t.id === 'cshare' || t.id === 'corg' || t.id === 'preview') {
      const bill = buildBill();
      if (!bill.items.length) { $('#msg').textContent = 'Add at least one item with a name.'; return; }
      const mode = t.id === 'corg' ? 'o' : 's';
      if (t.id === 'preview') { location.hash = encode(bill, 'o'); return; }
      const url = linkFor(bill, mode);
      copy(url, t);
      $('#msg').textContent = mode === 'o' ? 'Organizer link copied (for you only).' : 'Share link copied — post it in the group chat.';
    }
  } else if (t.id === 'edit') {
    draft = draftFromBill(view.bill);
    history.replaceState(null, '', location.pathname);
    view = { mode: 'create' }; render();
  }
});

// ---------- friend view ----------
function renderFriend() {
  const b = view.bill, org = b.organizer;
  const head = `<h1>Yabi Split Bill</h1>`;
  const picker = `<div class="card"><label>Who are you?</label><select id="me"><option value="">Pick your name…</option>${b.people.map((p) => `<option ${p === view.me ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>`;
  const edit = `<div class="actions"><button id="edit">Edit this bill</button></div>`;
  if (!view.me) { app.innerHTML = head + picker + edit; return; }
  const me = view.me;
  const optins = {};
  view.joined.forEach((i) => (optins[i] = [me]));
  const r = compute(b, optins);
  const mine = r.owes[me];
  let req = '', opt = '', fronted = '';
  b.items.forEach((it, i) => {
    const eligible = it.participants.includes(me);
    if (!it.optional && eligible) {
      const s = itemShares(it).find((x) => x.name === me).cents;
      req += `<div class="line"><span>${esc(it.name)}</span><span>$${fmt(s)}</span></div>`;
    }
    if (it.optional && eligible) {
      const per = optionalPerPerson(it);
      opt += `<label class="inline"><input type="checkbox" data-join="${i}" ${view.joined.includes(i) ? 'checked' : ''}> Join ${esc(it.name)}? +$${fmt(per)}</label>`;
    }
    if (it.paidBy === me && me !== org) {
      fronted += `<div class="note">You fronted ${esc(it.name)}${it.optional ? '' : ` ($${fmt(it.amount)})`} — ${esc(org)} will pay you back${it.optional ? ' for everyone who joins' : ''}. You still Zelle ${esc(org)} your own share.</div>`;
    }
  });
  const isOrg = me === org;
  const summary = summaryLine(me, org, mine.lines, mine.total);
  app.innerHTML = head + picker + `<div class="card"><h2>Your breakdown</h2>${req || '<div class="mute">No required items.</div>'}${opt ? `<h2 style="margin-top:12px">Optional</h2>${opt}` : ''}${fronted}</div>
  <div class="card">${isOrg
    ? `<div class="mute">You're the organizer — nothing to Zelle. Your own cost:</div><div class="big">$${fmt(mine.total)}</div>`
    : `<div class="big">Zelle ${esc(org)} $${fmt(mine.total)}</div>`}</div>
  <div class="actions">${isOrg ? '' : '<button class="primary" id="csum">Copy summary</button>'}<button id="edit">Edit this bill</button></div>`;
  const cs = $('#csum');
  if (cs) cs.onclick = () => copy(summary, cs);
}

// ---------- organizer view ----------
function renderOrganizer() {
  const b = view.bill, org = b.organizer;
  const r = compute(b, b.optins);
  const optItems = b.items.map((it, i) => ({ it, i })).filter((x) => x.it.optional);
  const lists = optItems.map(({ it, i }) => `<div class="card"><h2>${esc(it.name)} — who joined? <span class="mute">($${fmt(optionalPerPerson(it))} each, paid by ${esc(it.paidBy)})</span></h2>
    <div class="chips">${it.participants.map((p) => `<label class="chip"><input type="checkbox" data-opt="${i}" data-name="${esc(p)}" ${(b.optins[i] || []).includes(p) ? 'checked' : ''}>${esc(p)}</label>`).join('')}</div></div>`).join('');
  const toOrg = b.people.filter((p) => p !== org && r.owes[p].total > 0).map((p) => ({ txt: `${p} → ${org}: $${fmt(r.owes[p].total)}`, pay: false }));
  const toFronters = Object.entries(r.fronted).map(([p, c]) => ({ txt: `${org} → ${p}: $${fmt(c)}`, pay: true }));
  const rows = [...toOrg, ...toFronters];
  app.innerHTML = `<h1>Organizer view</h1>
  <div class="mute" style="margin-bottom:8px">Tick opt-ins from the group chat, then re-copy your organizer link to save progress.</div>
  ${lists || '<div class="card mute">No optional items.</div>'}
  <div class="card"><h2>Settlement</h2>${rows.map((x) => `<div class="line"><span>${esc(x.txt)}</span></div>`).join('') || '<div class="mute">Nothing yet.</div>'}
    <div class="line" style="margin-top:8px"><span>Total ${esc(org)} collects</span><b>$${fmt(r.collects)}</b></div>
    <div class="line"><span>Total ${esc(org)} pays out</span><b>$${fmt(r.paysOut)}</b></div>
    <div class="line"><span>${esc(org)}'s own cost (own shares)</span><b>$${fmt(r.organizerCost)}</b></div></div>
  <div class="actions"><button class="primary" id="cpay">Copy payouts</button><button id="corg2">Copy organizer link</button><button id="cshare2">Copy share link</button><button id="edit">Edit</button></div>`;
  $('#cpay').onclick = (e) => copy(toFronters.map((x) => x.txt).join('\n') || 'No payouts', e.target);
  $('#corg2').onclick = (e) => copy(linkFor(b, 'o'), e.target);
  $('#cshare2').onclick = (e) => copy(linkFor(b, 's'), e.target);
}

route();
