// ===== Preloader: fill screen with orange bubbles, then fade out =====
function runPreloader(){
  try{
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = sessionStorage.getItem('roe_preloader_seen') === '1';
    const pre = document.getElementById('preloader');
    if (!pre) return;
    if (prefersReduced || seen) { pre.classList.add('hide'); return; }

    const layer = document.getElementById('bubble-layer');
    const W = window.innerWidth, H = window.innerHeight;
    const count = Math.max(24, Math.min(64, Math.floor((W*H)/30000))); // responsive density
    

    for (let i=0;i<count;i++){
      const d = 40 + Math.random()* (Math.min(W,H)/2);
      const x = Math.random()*(W - d);
      const y = Math.random()*(H - d);
      const b = document.createElement('div');
      b.className = 'bub';
      b.style.left = x+'px';
      b.style.top = y+'px';
      b.style.width = d+'px';
      b.style.height = d+'px';
      const delay = Math.random()*300;
      b.style.animation = `bubPop 900ms ${delay}ms cubic-bezier(.2,.6,.2,1) forwards`;
      layer.appendChild(b);
    }

    setTimeout(()=>{ pre.classList.add('hide'); }, 1600);
    setTimeout(()=>{ pre.parentNode?.removeChild(pre); }, 2000);
    sessionStorage.setItem('roe_preloader_seen','1');
  }catch(e){ console.warn(e); document.getElementById('preloader')?.classList.add('hide'); }
}
runPreloader();

// Config
const SECTION_ORDER = [
  "happy hour",
  "wine",
  "cocktails",
  "drafts",
  "mocktails",
  "after-dinner wine",
  "after-dinner martinis"
];

const CATEGORY_TO_SECTION = {
  "happy hour": "happy hour",
  "wine": "wine",
  "cocktails": "cocktails",
  "mocktails": "mocktails",
  "after-dinner wine": "after-dinner wine",
  "after-dinner martinis": "after-dinner martinis"
};

// Subtext/notes under section titles
const SECTION_META = {
  "happy hour": { note: "Mon\u2013Fri 3\u20136pm" },
  "mocktails": { note: "Add choice of spirit for an upcharge" },
  "drafts":    { note: "Rotating selection — ask your server" }
};

// Item-specific options (by name, case-insensitive)
const ITEM_OPTIONS = {
  'gummy bear martini': ['Apple', 'Grape', 'Watermelon'],
  'gymmy bear martini': ['Apple', 'Grape', 'Watermelon'], // alias, just in case
};
const keyName = (s) => (s || '').trim().toLowerCase();


// Wine subcategory rules
const OTHER_REDS_SET = new Set(["merlot", "red blend", "zinfandel", "malbec"]);
const OTHER_REDS_LABEL = "Other Reds";

// Helper: currency formatting (with $)
const fmtMoney = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const val = Math.round(Number(n) * 100) / 100;
  const asInt = Number.isInteger(val);
  return asInt ? `$${val}` : `$${val.toFixed(2)}`;
};

// Helper: plain number formatting (no $)
const fmtPlain = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const val = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(val) ? `${val}` : `${val.toFixed(2)}`;
};

const titleCase = (s) => s.replace(/(^|\s|-)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());

// Normalize a name for matching
function normName(s){
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')      // collapse spaces
    .trim();
}

// Rank for custom Happy Hour order
function getHappyHourRank(name){
  const n = normName(name);

  if (n.startsWith('pbr')) return 0;
  if (n.startsWith('draft')) return 1;
  if (n.includes('rotating red and white')) return 2;
  if (isRoesysPearl(name)) return 3; // uses your existing helper
  if (n.startsWith('vodka or gin martini')) return 4;
  if (n.includes('gummy bear martini') || n.includes('gymmy bear martini')) return 5;

  return 100; // anything else goes after (alphabetical fallback)
}


function isRoesysPearl(name) {
  if (!name) return false;
  const n = name.toLowerCase().replace(/[^\w\s]/g, "");
  return n.includes("roesys pearl") || (n.includes("roesys") && n.includes("pearl"));
}

// Load and render
async function init() {
  const res = await fetch('menu.json');
  const data = await res.json();

  // Group items by final sections
  const sections = {};
  SECTION_ORDER.forEach(key => sections[key] = []);

  data.forEach(item => {
    const cat = (item.category_norm || "").trim().toLowerCase();
    const section = CATEGORY_TO_SECTION[cat];
    if (section) sections[section].push(item);
  });

  // Add Drafts placeholder
  sections["drafts"].push({
    name: "Rotating Draft Selection",
    special: "Rotating selection — ask your server",
    category_norm: "drafts"
  });

  // Sort within sections (Roesy's Pearl first in cocktails)
  // Sort within sections
  Object.keys(sections).forEach(k => {
    if (k === "cocktails") {
      sections[k].sort((a, b) => {
        const aIsR = isRoesysPearl(a.name);
        const bIsR = isRoesysPearl(b.name);
        if (aIsR && !bIsR) return -1;
        if (!aIsR && bIsR) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
    } else if (k === "happy hour") {
      // Custom order for Happy Hour
      sections[k].sort((a, b) => {
        const ra = getHappyHourRank(a.name);
        const rb = getHappyHourRank(b.name);
        if (ra !== rb) return ra - rb;
        return (a.name || "").localeCompare(b.name || "");
      });
    } else if (k !== "wine") {
      sections[k].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  });


  renderTabs(SECTION_ORDER);
  renderSections(sections);
  setupScrollSpy();
}

function renderTabs(order) {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = "";
  tabButtons = {};

  order.forEach((key, idx) => {
    const btn = document.createElement('button');
    btn.textContent = titleCase(key.replaceAll('-', ' '));
    btn.onclick = () => {
  const el = document.getElementById(`sec-${key}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setActiveTab(key, { scrollMode: 'center' });
  };

    if (idx === 0) btn.classList.add('active');
    tabs.appendChild(btn);
    tabButtons[key] = btn;
  });
}


function renderSections(sections) {
  const root = document.getElementById('content');
  root.innerHTML = "";
  Object.keys(sections).forEach(key => {
    const items = sections[key];
    const sec = document.createElement('section');
    sec.className = 'section';
    sec.id = `sec-${key}`;

    const h2 = document.createElement('h2');
    if (key === "cocktails") {
      h2.innerHTML = 'Signature Craft Cocktails<br><span class="subtitle">"Roes Greatest Hits"</span>';
    } else {
      h2.textContent = titleCase(key.replaceAll('-', ' '));
    }
    sec.appendChild(h2);

    // Optional section note
    if (SECTION_META[key]?.note) {
      const note = document.createElement('div');
      note.className = 'muted';
      note.style.marginTop = "-6px";
      note.style.marginBottom = "10px";
      note.textContent = SECTION_META[key].note;
      sec.appendChild(note);
    }

    if (key === "wine") {
      renderWineSubsections(sec, items);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';
      if (!items || items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No items yet.';
        sec.appendChild(empty);
      } else {
        items.forEach(it => grid.appendChild(renderCard(it, key)));
        sec.appendChild(grid);
      }
    }

    root.appendChild(sec);
  });
}


function renderWineSubsections(container, items) {
  // Group by grape; send specified grapes to "Other Reds"
  const groups = new Map(); // grape => items[]
  const otherReds = [];

  (items || []).forEach(it => {
    const grape = (it.grape || "").trim();
    const grapeKey = grape.toLowerCase();
    if (OTHER_REDS_SET.has(grapeKey)) {
      otherReds.push(it);
    } else {
      if (!groups.has(grape)) groups.set(grape, []);
      groups.get(grape).push(it);
    }
  });

  // Sort grapes A->Z; "Other Reds" at end if present
  const grapeNames = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b));
  if (otherReds.length) grapeNames.push(OTHER_REDS_LABEL);

  grapeNames.forEach(gn => {
    const sub = document.createElement('div');
    sub.className = 'subsection';

    const h3 = document.createElement('h3');
    h3.className = 'subheading';
    h3.textContent = gn || "Other";
    sub.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'grid';

    const list = (gn === OTHER_REDS_LABEL) ? otherReds : (groups.get(gn) || []);
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    list.forEach(it => grid.appendChild(renderCard(it, "wine")));

    sub.appendChild(grid);
    container.appendChild(sub);
  });
}

function renderCard(it, sectionKey) {
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = it.name || "Unnamed Item";
  card.appendChild(title);

  // Hide grape line in Wine & Mocktails (grape already shown as wine subheading)
  if (it.grape && sectionKey !== "wine") {
    const sub = document.createElement('div');
    sub.className = 'item-sub';
    sub.textContent = it.grape;
    card.appendChild(sub);
  }

  // Happy Hour item options (chips)
  if (sectionKey === 'happy hour') {
    const opts = ITEM_OPTIONS && ITEM_OPTIONS[keyName(it.name)];
    if (opts && opts.length) {
      const wrap = document.createElement('div');
      wrap.className = 'options';
      opts.forEach(o => {
        const chip = document.createElement('span');
        chip.className = 'badge';
        chip.textContent = o;
        wrap.appendChild(chip);
      });
      card.appendChild(wrap);
    }
  }

  // Pricing logic by section
  const prices = [];
  if (sectionKey === "cocktails") {
    // All cocktails $18 except Roesy's Pearl $15
    const price = isRoesysPearl(it.name) ? 15 : 18;
    prices.push(`${price}`);
  } else if (sectionKey === "mocktails") {
    prices.push(`10`);
  } else if (sectionKey === "after-dinner martinis") {
    prices.push(`17`);
  } else if (sectionKey === "drafts") {
    // Show badge/note only
    if (it.special) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = it.special;
      card.appendChild(badge);
    }
  } else {
    // Default wine/happy hour/after-dinner wine: use CSV prices
    const nameLower = (it.name || '').toLowerCase();
    const isSplit = nameLower.includes('split') || nameLower.includes('375');

    const g = fmtPlain(it.glass_price);
    const b = fmtPlain(it.bottle_price);

    if (isSplit && b) {
      // For split-sized bottles; shows "Split 15"
      prices.push(`Split ${b}`);
    } else {
      if (g && b) prices.push(`${g}/${b}`);   // -> "15/40"
      else if (g)  prices.push(`${g}`);       // -> "15"
      else if (b)  prices.push(`${b}`);       // -> "40"
    }
  }

  if (prices.length) {
    const line = document.createElement('div');
    line.className = 'price-line';
    prices.forEach(p => {
      const span = document.createElement('span');
      span.textContent = p;
      line.appendChild(span);
    });
    card.appendChild(line);
  }

  return card;
}


init().catch(err => {
  document.getElementById('content').textContent = "Failed to load menu.json";
  console.error(err);
});


// --- ScrollSpy helpers (stable, scroll-position based) ---
let tabButtons = {};
let __sectionsMeta = [];

function setActiveTab(key, { scrollMode = null } = {}) {
  const tabs = document.getElementById('tabs');
  if (!tabs) return;
  Array.from(tabs.children).forEach(b => {
    b.classList.remove('active');
    b.setAttribute?.('aria-selected', 'false');
  });
  const btn = tabButtons[key];
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute?.('aria-selected', 'true');

    // Scroll the tab band if asked:
    // - 'center'  => center on clicks
    // - 'nearest' => just bring into view on scrollspy (gentle)
    if (scrollMode) {
      btn.scrollIntoView({
        behavior: 'smooth',
        inline: scrollMode === 'center' ? 'center' : 'nearest',
        block: 'nearest'
      });
    }
  }
}


function getHeaderOffset() {
  const h = document.querySelector('.site-header')?.getBoundingClientRect().height || 80;
  return Math.ceil(h) + 8; // small breathing room
}

function captureSections() {
  // Build & sort list of sections by vertical position
  __sectionsMeta = SECTION_ORDER
    .map(key => {
      const el = document.getElementById(`sec-${key}`);
      return el ? { key, el } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.el.offsetTop - b.el.offsetTop);
}

function throttle(fn, wait) {
  let last = 0, timer = null, savedArgs, savedThis;
  return function throttled(...args) {
    const now = Date.now();
    const remain = wait - (now - last);
    savedArgs = args; savedThis = this;
    if (remain <= 0) {
      last = now;
      fn.apply(savedThis, savedArgs);
      savedArgs = savedThis = null;
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(savedThis, savedArgs);
        savedArgs = savedThis = null;
      }, remain);
    }
  };
}

function onScrollSpy() {
  if (!__sectionsMeta.length) return;
  const y = window.scrollY + getHeaderOffset();
  // Pick the last section whose top is <= current offset line
  let activeKey = __sectionsMeta[0].key;
  for (const { key, el } of __sectionsMeta) {
    if (el.offsetTop <= y) activeKey = key; else break;
  }
  setActiveTab(activeKey, { scrollMode: 'nearest' });
}

function setupScrollSpy() {
  captureSections();
  onScrollSpy();
  window.addEventListener('scroll', throttle(onScrollSpy, 50), { passive: true });
  window.addEventListener('resize', () => { captureSections(); onScrollSpy(); });
}
