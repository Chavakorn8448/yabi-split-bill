import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCents, compute, summaryLine, optionalPerPerson } from '../money.js';

const ALL = ['Sarah', 'Derek', 'Megan', 'Rita', 'Trav', 'Yining', 'Ball', 'Annie'];
const bill = {
  organizer: 'Sarah',
  people: ALL,
  items: [
    { name: 'Hotpot', amount: 8224, participants: ALL, paidBy: 'Sarah' },
    { name: 'Uber Eats', amount: 6000, participants: ['Sarah', 'Trav', 'Derek', 'Rita', 'Annie', 'Megan'], paidBy: 'Sarah' },
    { name: 'Cake', optional: true, per: 700, participants: ALL, paidBy: 'Derek' },
    { name: 'Mahjong', optional: true, per: 1000, participants: ALL, paidBy: 'Sarah' },
  ],
};

test('leftover cents go to first participants', () => {
  assert.deepEqual(splitCents(1000, 3), [334, 333, 333]);
  assert.equal(splitCents(8224, 8).reduce((a, b) => a + b), 8224);
});

test('optional per-person from total/headcount (rounded up)', () => {
  assert.equal(optionalPerPerson({ total: 7000, headcount: 7 }), 1000);
  assert.equal(optionalPerPerson({ total: 1000, headcount: 3 }), 334);
  assert.equal(optionalPerPerson({ per: 500, total: 9999, headcount: 2 }), 500);
});

test('Trav: required 20.28, all 37.28', () => {
  assert.equal(compute(bill, {}).owes.Trav.total, 2028);
  const r = compute(bill, { 2: ['Trav'], 3: ['Trav'] });
  assert.equal(r.owes.Trav.total, 3728);
  assert.equal(
    summaryLine('Trav', 'Sarah', r.owes.Trav.lines, r.owes.Trav.total),
    'Trav: Zelle Sarah $37.28 (hotpot 10.28, ubereats 10, cake 7, mahjong 10)'
  );
});

test('Yining: hotpot only', () => {
  assert.equal(compute(bill, {}).owes.Yining.total, 1028);
});

test('Derek pays full share incl. cake; Sarah repays him all cake money', () => {
  const r = compute(bill, { 2: ['Derek', 'Trav', 'Rita', 'Annie'], 3: ['Trav', 'Rita'] });
  assert.equal(r.owes.Derek.total, 2028 + 700);
  assert.equal(r.fronted.Derek, 2800);
  assert.equal(r.owes.Trav.total, 3728);
  assert.equal(r.paysOut, 2800);
  assert.equal(r.collects, Object.entries(r.owes).filter(([n]) => n !== 'Sarah').reduce((a, [, v]) => a + v.total, 0));
  assert.equal(r.organizerCost, 2028); // hotpot + uber; Sarah did not opt in to extras
});
