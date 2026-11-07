// Part B grading, from the agent's final answer (+ for 'charger' the URLs it visited, + for 'weekend' the saved file).
const money = (s) => [...String(s).matchAll(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g)].map((m) => +m[1].replace(/,/g, ''));
const links = (s, re) => [...String(s).matchAll(/https?:\/\/[^\s)\]>"'`]+/g)].map((m) => m[0]).filter((u) => re.test(u));
function grade(task, res, t, lib) {
  const final = String((res && res.final) || '');
  if (/BLOCKED/.test(final)) return { pass: false, blocked: true };
  if (task === 'dinner') { const l = links(final, /resy\.com\/cities\/[^/]+\/venues\//i); const time = /\b(6:[3-5]\d|7:[0-5]\d|8:00)\s?(PM|pm|P\.M\.)?/.test(final); return { pass: l.length > 0 && time, venue_link: l[0] || null, time_found: time }; }
  if (task === 'charger') { const atCart = (res.urls || []).some((u) => /anker\.com\/cart/i.test(u)) || /anker\.com\/cart/i.test(final); const m = money(final); return { pass: atCart && m.length > 0 && /nano/i.test(final), at_cart: atCart, prices: m }; }
  if (task === 'compare') { const m = money(final).filter((x) => x > 50 && x < 600); const l = links(final, /(apple\.com|verizon\.com)/i); return { pass: m.length >= 2 && l.length > 0, prices: m, link: l[0] || null }; }
  if (task === 'weekend') { const l = [...new Set(links(final, /funcheap\.com\/\S+/i))]; return { pass: l.length >= 3 && !!lib, links: l.length, saved_file: !!lib }; }
  if (task === 'stock') { const m = money(final); const v = m[0]; return { pass: v != null && t.nvda != null && Math.abs(v - t.nvda) / t.nvda <= 0.03, value: v, expected: t.nvda }; }
}
module.exports = { grade, money, links };
