// Token Radar dashboard. Reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with
// the model's own inputs and the protocol's farm plan, and the model itself.
// No network: every byte shown is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function age(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function catMult(c) {
    for (var i = 0; i < DATA.calibration.length; i++)
      if (DATA.calibration[i].category === (c || 'Other')) return DATA.calibration[i].multiple;
    return DATA.global_multiple;
  }
  // The model, as the page recomputes it: the number must match board.json.
  function mults(row) {
    var m = DATA.model;
    var g = clamp(row.g === null || row.g === undefined ? 0 : row.g, m.growth_floor, m.growth_cap);
    var a = row.a === null || row.a === undefined ? m.unknown_age_days : row.a;
    return {
      g: g,
      gm: 1 + (g / 100) * m.growth_weight,
      mm: m.maturity_floor + (Math.min(Math.max(a, 0), m.maturity_days) / m.maturity_days) * m.maturity_range,
      cm: 1 + Math.min(Math.max((row.nc || 1) - 1, 0), m.chain_max_extra) * m.chain_step,
      km: catMult(row.c),
      age: a
    };
  }
  function impliedOf(row) {
    var x = mults(row);
    return Math.max(1, Math.round(row.t * x.km * x.gm * x.mm * x.cm));
  }

  // Farm plan: the same derivation main.ts writes to board.json. $C = capital,
  // $N = protocol name, $H = first chain. No name is special-cased.
  var ACTS = [
    ['lend|cdp|collateral', 'Supply $C of USDC to $N on $H and keep the position open.', 'Borrow a small amount against the supply on $N, then repay it the same week.'],
    ['dex|yield|leveraged farm', "Provide $C of liquidity to $N's main pool on $H and keep the position open.", "Swap a small amount through $N's main pool on $H once a week."],
    ['bridge', 'Bridge $C of USDC to $H through $N and use the bridged funds in its app.', 'Use the bridged funds in an app on $H once a week, then bridge a little back.'],
    ['staking|restak', "Stake $C of the chain's staking asset through $N and keep the receipt token.", 'Claim the staking rewards on $N once a month and restake them.'],
    ['perpetual|derivative', 'Deposit $C of USDC as margin on $N and open one small hedge.', 'Close the hedge on $N once a month and open a fresh one.'],
    ['prediction', 'Fund $C and place one market position on $N.', 'Settle one market on $N and claim any winnings before opening the next.'],
    ['curator|allocator', 'Deposit $C into a $N vault on $H and keep the shares.', "Review the vault's allocation on $N once a month and top it up if it changed."],
    ['stable', 'Mint or deposit $C of the stable asset through $N on $H.', 'Redeem a small part of the stable position on $N once, to prove the exit works.'],
    ['rwa', "Mint $C of the protocol's yield asset on $H and hold it.", 'Check the yield that accrued on the $N asset once a month and record it.'],
    ['insurance', 'Buy $C of cover from $N on $H and keep the policy.', "Review the cover's terms on $N once a month and renew it before it lapses."]
  ];
  function fill(tpl, c, n, h) { return tpl.replace(/\$C/g, '$' + c).replace(/\$N/g, n).replace(/\$H/g, h); }
  function farmSteps(row) {
    var chain = row.h || 'its main chain';
    var capital = row.t >= 5e9 ? 250 : row.t >= 1e9 ? 150 : row.t >= 1e8 ? 100 : 50;
    var hold = row.a === null || row.a === undefined ? 30 : row.a < 180 ? 60 : row.a < 365 ? 45 : 30;
    var c = (row.c || '').toLowerCase();
    var act = ['Deposit $C of USDC into $N on $H and keep the position open.', 'Repeat one qualifying action on $N each week, such as a deposit, a swap or a vote.'];
    for (var i = 0; i < ACTS.length; i++) {
      var keys = ACTS[i][0].split('|');
      for (var j = 0; j < keys.length; j++) {
        if (c.indexOf(keys[j]) >= 0) { act = [ACTS[i][1], ACTS[i][2]]; i = ACTS.length; break; }
      }
    }
    var steps = [
      ['Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'],
      [fill(act[0], capital, row.n, chain), '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', '15 minutes to set up'],
      [fill(act[1], capital, row.n, chain), 'about $2 of gas a week', '10 minutes a week'],
      ['Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'],
      ["Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", 'no fee to check, and never pay to claim', '10 minutes'],
      ['Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes']
    ];
    return steps.map(function (s) {
      var out = s[0] + ' Cost: ' + s[1] + '. Time: ' + s[2] + '.';
      return out.length > 600 ? out.slice(0, 596) + '...' : out;
    });
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (p.get('q')) state.q = p.get('q');
    if (p.get('p')) state.selected = p.get('p');
    if (p.get('category')) state.category = p.get('category');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('wl') === '1') state.wl = true;
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.wl) p.set('wl', '1');
    if (state.tab !== 'pre-token') p.set('tab', state.tab);
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.w) return false;
      if (state.category !== 'all' && (r.c || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.h !== state.chain) return false;
      if (!q) return true;
      return [r.n, r.s, r.c, r.h].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    return list.slice().sort(function (a, b) {
      var av, bv, k = state.sort;
      if (k === 'name') { av = a.n.toLowerCase(); bv = b.n.toLowerCase(); }
      else if (k === 'tvl') { av = a.t; bv = b.t; }
      else if (k === 'growth') { av = a.g === null ? -Infinity : a.g; bv = b.g === null ? -Infinity : b.g; }
      else if (k === 'age') { av = a.a === null ? Infinity : a.a; bv = b.a === null ? Infinity : b.a; }
      else { av = a.v; bv = b.v; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.s < b.s ? -1 : a.s > b.s ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, 'TOKEN ', el('b', { text: 'RADAR' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })));
  }
  function lede() {
    return el('section', { class: 'lede' },
      el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied launch value' }),
      el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, by TVL. Implied value is a model, not a promise — and never a prediction that a token launches.' }),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))));
  }
  function spotlight() {
    return el('section', { class: 'spot' }, DATA.rows.slice(0, 10).map(function (r) {
      return el('button', { class: 'card', type: 'button', onclick: function () { openDetail(r.s); } },
        el('span', { class: 'rank', text: '#' + r.r }),
        el('span', { class: 'nm', text: r.n }),
        el('span', { class: 'val', text: usd(r.v) }),
        el('span', { class: 'sub', text: 'TVL ' + usd(r.t) + ' · ' + pct(r.g) + ' 7d' }));
    }));
  }
  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.c || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.map(function (r) { return r.h || ''; }).filter(Boolean))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function sel(id, label, all, values, cur, fn) {
      var s = el('select', { id: id, 'aria-label': label },
        el('option', { value: 'all', text: all }),
        values.map(function (v) { return el('option', { value: v, text: v, selected: v === cur ? 'selected' : null }); }));
      s.addEventListener('change', function () { fn(s.value); writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
    }
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.wl ? 'checked' : null });
    wl.addEventListener('change', function () { state.wl = wl.checked; writeHash(); render(); });
    var sort = el('select', { id: 'sort', 'aria-label': 'Sort by' },
      [['implied', 'Implied value'], ['tvl', 'TVL'], ['growth', '7d growth'], ['age', 'Age'], ['name', 'Name']].map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: state.sort === o[0] ? 'selected' : null }); }));
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = -1; render(); });
    function tabBtn(tab, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label, onclick: function () { state.tab = tab; writeHash(); render(); } });
    }
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      sel('category', 'Category', 'All categories', categories, state.category, function (v) { state.category = v; }),
      sel('chain', 'Chain', 'All chains', chains, state.chain, function (v) { state.chain = v; }),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort by' }), sort),
      el('label', { class: 'check' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'View' }), el('div', { class: 'tabs' }, tabBtn('pre-token', 'Pre-token'), tabBtn('live', 'Live token'), tabBtn('model', 'Model'))),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : 'How the ranking is computed' }));
  }
  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null));
  }
  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; writeHash(); render(); } })));
    }
    var max = 1;
    list.forEach(function (r) { if (r.v > max) max = r.v; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var gc = r.g === null ? '' : r.g >= 0 ? 'pos' : 'neg';
      var badge = r.w ? el('span', { class: 'badge wl', text: 'WATCHLIST' }) : el('span', { class: 'badge er', text: 'EARLY' });
      tbody.appendChild(el('tr', {
        tabindex: '0',
        onclick: function () { openDetail(r.s); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.s); } }
      },
        el('td', { class: 'num', text: String(r.r) }),
        el('td', null, el('div', { class: 'name' }, el('b', null, document.createTextNode(r.n), badge),
          el('span', { class: 'sub', text: (r.c || 'Other') + ' on ' + (r.h || 'an unnamed chain') }))),
        el('td', { class: 'num', text: usd(r.t) }),
        el('td', { class: 'num ' + gc, text: pct(r.g) }),
        el('td', { class: 'num', text: age(r.a) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.v / max) * 100)) + '%' })),
          el('span', { class: 'num', text: usd(r.v) }))),
        el('td', null, el('span', { class: 'status', text: 'no token' }))));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' }))),
          tbody)));
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.n }), el('span', { class: 'sub', text: (r.c || 'Other') + ' on ' + (r.h || 'an unnamed chain') }))),
        el('td', { class: 'num', text: usd(r.t) }),
        el('td', { class: 'num ' + (r.g !== null && r.g >= 0 ? 'pos' : 'neg'), text: pct(r.g) }),
        el('td', { class: 'num', text: usd(r.m) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and their market-cap-to-TVL ratios calibrate it.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody)));
  }
  function modelPanel() {
    var m = DATA.model;
    var calRows = DATA.calibration.map(function (c) {
      return el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: c.multiple.toFixed(3) + 'x' }),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { text: c.fallback ? 'global median' : 'category median' }));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every protocol, from the snapshot figures alone. No name is special-cased, no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x categoryMultiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + min(chains - 1, ' + m.chain_max_extra + ') x ' + m.chain_step + ') )'),
      el('p', { class: 'sub', text: 'Category multiple: the median market-cap-to-TVL ratio of the snapshot\u2019s own live-token protocols in that category (at least ' + m.min_category_comps + ' with both figures), clamped to [' + m.multiple_min + ', ' + m.multiple_max + ']; a thin category takes the global median of ' + DATA.global_multiple.toFixed(3) + 'x. Age is the time since the protocol was first listed; an unlisted age uses ' + m.unknown_age_days + ' days. Chain breadth adds at most ' + (m.chain_max_extra * m.chain_step * 100).toFixed(0) + '%.' }),
      el('h2', { text: 'Calibration: market-cap-to-TVL by category' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cal' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Multiple' }), el('th', { scope: 'col', text: 'Live comps' }), el('th', { scope: 'col', text: 'Source' }))),
          el('tbody', null, calRows))),
      el('p', { class: 'note', text: 'The watchlist is a floor, never a ceiling: the early radar is every rankable pre-token protocol below the floor, by TVL. Protocols above the floor that the watchlist leaves out are wrapped, staked or bridged products of tokens that already trade, so they are not pre-token launches.' }));
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) { if (DATA.rows[i].s === slug) { row = DATA.rows[i]; break; } }
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var x = mults(row);
    var recomputed = impliedOf(row);
    var why = row.w
      ? 'On the watchlist: at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record.'
      : 'Early radar: below the watchlist floor, ranked on the same model as every watchlist row.';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.r + ' of ' + DATA.board_size + (row.w ? ' · Watchlist' : ' · Early') }),
        el('h2', { id: 'detail-title', text: row.n }),
        el('p', { class: 'sub', text: (row.c || 'Other') + ' on ' + (row.h || 'an unnamed chain') })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: usd(row.t) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: x.km.toFixed(3) + 'x' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: pct(row.g) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: x.gm.toFixed(4) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: age(row.a) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: x.mm.toFixed(4) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: x.cm.toFixed(4) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: usd(row.v) }))),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + usd(recomputed) + (recomputed === row.v ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' ' + why + ' This is an estimate, not a price, and not a prediction that a token launches.' })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        return el('li', null, el('b', { text: at >= 0 ? s.slice(0, at) : s }), el('span', { class: 'cost', text: at >= 0 ? s.slice(at + 1) : '' }));
      }))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', { text: 'Data: DefiLlama protocol index, snapshot ' + DATA.as_of + '. A protocol is shown as recording no token when the snapshot records none for it; that is the record, not proof it has none. Implied values are this radar\u2019s own claim, computed by model ' + DATA.model_version + ' from the snapshot figures. Farm steps are a plan, not advice: never pay to claim, and never farm with money you cannot lose.' }));
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') shell.appendChild(spotlight());
    shell.appendChild(controls());
    if (state.tab === 'pre-token') shell.appendChild(boardTable());
    else if (state.tab === 'live') shell.appendChild(liveTable());
    else shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
