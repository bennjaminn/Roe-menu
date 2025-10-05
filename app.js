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
  "sparkling",
  "cocktails",
  "drafts",
  "mocktails",
  "after-dinner wine",
  "after-dinner martinis"
];

const CATEGORY_TO_SECTION = {
  "happy hour": "happy hour",
  "wine": "wine",
  "sparkling": "sparkling",
  "cocktails": "cocktails",
  "mocktails": "mocktails",
  "after-dinner wine": "after-dinner wine",
  "after-dinner martinis": "after-dinner martinis"
};

// Subtext/notes under section titles
const SECTION_META = {
  "happy hour": { note: "Mon\u2013Fri 3\u20136pm" },
  "mocktails": { note: "Add choice of spirit for an upcharge" },
  "drafts":    { note: "Rotating selection — ask your server" },
  "after-dinner wine": {note:'by the glass'}
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

// Treat these as Sparkling for this specific menu.json
const SPARKLING_GRAPES = new Set(["brut", "prosecco", "rosé", "rose"]);
const isSparklingItem = (it) => SPARKLING_GRAPES.has((it.grape || "").trim().toLowerCase());


const titleCase = (s) => s.replace(/(^|\s|-)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());

function getSortPrice(it, sectionKey) {
  const g = (typeof it.glass_price === 'number' && !Number.isNaN(it.glass_price)) ? it.glass_price : null;
  const b = (typeof it.bottle_price === 'number' && !Number.isNaN(it.bottle_price)) ? it.bottle_price : null;

  if (sectionKey === 'wine') {
    // Wine: sort by glass price; if none, fall back to bottle
    return (g != null ? g : (b != null ? b : Number.POSITIVE_INFINITY));
  }
  if (sectionKey === 'sparkling') {
    // Sparkling: bottle first, then glass (keep previous behavior)
    return (b != null ? b : (g != null ? g : Number.POSITIVE_INFINITY));
  }
  return (g != null ? g : (b != null ? b : Number.POSITIVE_INFINITY));
}


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
  if (!sections["sparkling"]) sections["sparkling"] = []; // safety

  data.forEach(item => {
    const cat = (item.category_norm || "").trim().toLowerCase();
    let section = CATEGORY_TO_SECTION[cat]; // ← let, not const

    // If it's in Wine but grape is Brut/Prosecco/Rosé, move to Sparkling
    if (section === "wine" && isSparklingItem(item)) {
      section = "sparkling";
    }

    if (section) sections[section].push(item);
  });

  // Add Drafts placeholder
  if (sections["drafts"]) {
    sections["drafts"].push({
      name: "Rotating Draft Selection",
      special: "Rotating selection — ask your server",
      category_norm: "drafts"
    });
  }

  // Sort within sections (skip wine & sparkling — handled by subrenderers)
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
      sections[k].sort((a, b) => {
        const ra = getHappyHourRank(a.name);
        const rb = getHappyHourRank(b.name);
        if (ra !== rb) return ra - rb;
        return (a.name || "").localeCompare(b.name || "");
      });
    } else if (k !== "wine" && k !== "sparkling") {
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
    } else if (key === "sparkling") {
      renderSparklingSubsections(sec,items);
    
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';
      if (!items || items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No items yet.';
        sec.appendChild(empty);
      } else {
         // 🔽 Sort AFTER-DINNER WINE by price (glass → bottle), then name
        if (key === "after-dinner wine") {
          items.sort((a, b) => {
            const ga = (typeof a.glass_price === 'number' && !Number.isNaN(a.glass_price)) ? a.glass_price : null;
            const gb = (typeof b.glass_price === 'number' && !Number.isNaN(b.glass_price)) ? b.glass_price : null;
            const ba = (typeof a.bottle_price === 'number' && !Number.isNaN(a.bottle_price)) ? a.bottle_price : null;
            const bb = (typeof b.bottle_price === 'number' && !Number.isNaN(b.bottle_price)) ? b.bottle_price : null;

            const pa = (ga != null) ? ga : (ba != null ? ba : Infinity);
            const pb = (gb != null) ? gb : (bb != null ? bb : Infinity);

            if (pa !== pb) return pa - pb;                      // price first
            return (a.name || "").localeCompare(b.name || "");  // then name
          });
        }
        items.forEach(it => grid.appendChild(renderCard(it, key)));
        sec.appendChild(grid);
      }
    }

    root.appendChild(sec);
  });
}


function renderWineSubsections(container, items) {
  // Exact order you requested (matching your JSON's grape names)
  const ORDER = [
    "Chardonnay",
    "Sauvignon Blanc",
    "Pinot Grigio",
    "Riesling",
    "Pinot Noir",
    "Cabernet Sauvignon",
    "Other Reds"
  ];

  // Build buckets
  const buckets = new Map(ORDER.map(k => [k, []]));
  const extras = new Map(); // for anything not in ORDER (e.g., Brut / Prosecco / Rosé)

  (items || []).forEach(it => {
    const grape = (it.grape || "").trim();
    const key = grape.toLowerCase();

    if (OTHER_REDS_SET.has(key)) {
      buckets.get("Other Reds").push(it);
    } else if (buckets.has(grape)) {
      buckets.get(grape).push(it);
    } else {
      if (!extras.has(grape)) extras.set(grape, []);
      extras.get(grape).push(it);
    }
  });

  // Helper to render a single sub-section
  function renderSubsection(label, list, sectionKey = "wine") {
    if (!list.length) return;
    const sub = document.createElement('div');
    sub.className = 'subsection';

    // Display label tweaks: shorten "Cabernet Sauvignon" to "Cabernet"
    const displayLabel = (label === "Cabernet Sauvignon") ? "Cabernet" : label;

    const h3 = document.createElement('h3');
    h3.className = 'subheading';
    h3.textContent = displayLabel;
    sub.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'grid';
    list
      .slice()
      .sort((a, b) => {
        const pa = getSortPrice(a, "wine");
        const pb = getSortPrice(b, "wine");
        if (pa !== pb) return pa - pb;                      // price first
        return (a.name || "").localeCompare(b.name || "");  // then name
      })
      .forEach(it => grid.appendChild(renderCard(it, sectionKey)));

    sub.appendChild(grid);
    container.appendChild(sub);
  }

  // Render in the specified order first
  ORDER.forEach(label => renderSubsection(label, buckets.get(label) || []));

  // Then render any leftover grape groups (e.g., Brut / Prosecco / Rosé), alphabetically
  Array.from(extras.keys())
    .sort((a, b) => (a || "").localeCompare(b || ""))
    .forEach(label => renderSubsection(label || "Other", extras.get(label) || []));
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
    // Only treat items explicitly labeled "split" as splits
    const isSplit = nameLower.includes('split');

    const g = fmtPlain(it.glass_price);
    const b = fmtPlain(it.bottle_price);

    // Add emojis for wine sections only
    const isWineSection =
      sectionKey === 'wine' ||
      sectionKey === 'sparkling' ||
      sectionKey === 'after-dinner wine';

    if (isSplit && b) {
      prices.push(isWineSection ? `Split 🍾 ${b}` : `Split ${b}`);
    } else if (isWineSection) {
      if (g && b)      prices.push(`🍷 ${g} / 🍾 ${b}`);  // e.g., "🍷 12 / 🍾 40"
      else if (g)      prices.push(`🍷 ${g}`);
      else if (b)      prices.push(`🍾 ${b}`);
    } else {
      // Non-wine sections keep the plain numbers
      if (g && b)      prices.push(`${g}/${b}`);
      else if (g)      prices.push(`${g}`);
      else if (b)      prices.push(`${b}`);
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


function renderSparklingSubsections(container, items) {
  // --- Top: DIY Mimosa ---
  const diy = document.createElement('div');
  diy.className = 'subsection';

  const h3d = document.createElement('h3');
  h3d.className = 'subheading';
  h3d.textContent = 'DIY Mimosa';
  diy.appendChild(h3d);

  const gridD = document.createElement('div');
  gridD.className = 'grid';

  // Custom card: "Gambino Brut with Juice Flight" — $25
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = 'Gambino Brut with Juice Flight';
  card.appendChild(title);

  const priceLine = document.createElement('div');
  priceLine.className = 'price-line';
  const span = document.createElement('span');
  span.textContent = '25';
  priceLine.appendChild(span);
  card.appendChild(priceLine);

  gridD.appendChild(card);
  diy.appendChild(gridD);
  container.appendChild(diy);

  // --- Then: the regular sparkling groups ---
  const ORDER = ["Brut", "Prosecco", "Rosé"];
  const buckets = new Map(ORDER.map(k => [k, []]));

  (items || []).forEach(it => {
    const g = (it.grape || "").trim();
    const key = ORDER.find(label => label.toLowerCase() === g.toLowerCase()) || "Other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  });

  ORDER.concat(Array.from(buckets.keys()).filter(k => !ORDER.includes(k)).sort())
    .forEach(label => {
      const list = (buckets.get(label) || []);
      if (!list.length) return;

      const sub = document.createElement('div');
      sub.className = 'subsection';

      const h3 = document.createElement('h3');
      h3.className = 'subheading';
      h3.textContent = label;
      sub.appendChild(h3);

      const grid = document.createElement('div');
      grid.className = 'grid';
      list
        .slice()
        .sort((a, b) => {
          const isRose = label.toLowerCase().includes('ros');
          const pa = isRose
            ? ( (typeof a.glass_price === 'number') ? a.glass_price : (typeof a.bottle_price === 'number' ? a.bottle_price : Infinity) )
            : ( (typeof a.bottle_price === 'number') ? a.bottle_price : (typeof a.glass_price === 'number' ? a.glass_price : Infinity) );
          const pb = isRose
            ? ( (typeof b.glass_price === 'number') ? b.glass_price : (typeof b.bottle_price === 'number' ? b.bottle_price : Infinity) )
            : ( (typeof b.bottle_price === 'number') ? b.bottle_price : (typeof b.glass_price === 'number' ? b.glass_price : Infinity) );
          if (pa !== pb) return pa - pb;
          return (a.name || "").localeCompare(b.name || "");
        })
        .forEach(it => grid.appendChild(renderCard(it, "sparkling")));

      sub.appendChild(grid);
      container.appendChild(sub);
    });
}

