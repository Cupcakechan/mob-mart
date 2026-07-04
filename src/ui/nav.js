// nav.js — bottom navigation. Swaps ONLY the center panel (Shop / Upgrades / Workers / Bestiary)
// so the corner panels (Current Customer with Serve/Send Away, Battle Results) stay live on every
// tab. Owns visibility; content is rendered by panels.js. (Bestiary activated in Pass 4a.)
const TABS = [
  { id: 'shop',     label: 'Shop' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'workers',  label: 'Workers' },
  { id: 'fame',     label: 'Fame' },
  { id: 'bestiary', label: 'Bestiary' },
];

// Which center panel each tab shows. Tabs without an entry here don't swap the center.
const PANEL_FOR = { shop: 'items-panel', upgrades: 'upgrades-panel', workers: 'workers-panel', fame: 'fame-panel', bestiary: 'bestiary-panel' };

let navRoot = null;          // kept for the attention hook below
let activeTab = 'shop';
let wantAttention = false;   // "a sale is blocked by empty stock right now" (set by panels.js)

// Attention hook (called by renderPanels): when the front customer's item is out of stock, the
// signal must survive tab-blindness — the shelf card pulses on the Shop tab, and THIS makes the
// SHOP tab itself pulse whenever the shelf panel isn't the visible one. Chain: nav pulse -> click
// Shop -> pulsing card -> Restock.
export function setShopAttention(on) {
  wantAttention = on;
  applyShopAttention();
}
function applyShopAttention() {
  const btn = navRoot?.querySelector('.nav-btn[data-tab="shop"]');
  if (btn) btn.classList.toggle('attention', wantAttention && activeTab !== 'shop');
}

// Open a specific tab from OUTSIDE the nav (e.g. the hire goal chip). FORCE-OPEN semantics:
// unlike a nav-button click, calling this with the already-active tab does nothing — external
// callers mean "show me this panel", never "toggle it" (setTab's collapse is a nav-click gesture).
export function openTab(tab) {
  if (!navRoot || tab === activeTab) return;
  setTab(navRoot, tab);
}

export function initNav(root) {
  navRoot = root;
  root.innerHTML = TABS.map((t) => {
    const soon = t.disabled ? '<span class="nav-soon">soon</span>' : '';
    const dis = t.disabled ? ' disabled title="Coming soon"' : '';
    return `<button class="nav-btn" data-tab="${t.id}"${dis}>${t.label}${soon}</button>`;
  }).join('');

  root.querySelectorAll('.nav-btn').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => setTab(root, btn.dataset.tab));
  });
  setTab(root, null);   // boot COLLAPSED — the scene is the first thing a player sees
}

function setTab(root, tab) {
  if (tab === activeTab) tab = null;   // COLLAPSE: re-clicking the active tab dismisses the panel —
                                       // the diorama (and the speech bubble's airspace) is the
                                       // resting state; the attention pulses summon you back.
  activeTab = tab;
  applyShopAttention();      // switching to Shop clears the nav pulse (the card takes over)
  // Show the chosen center panel, hide the others (tab null -> all hidden).
  for (const panelId of Object.values(PANEL_FOR)) {
    const el = document.getElementById(panelId);
    if (el) el.classList.toggle('hidden', PANEL_FOR[tab] !== panelId);
  }
  root.querySelectorAll('.nav-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.tab === tab));
}
