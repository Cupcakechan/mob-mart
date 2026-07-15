// nav.js — bottom navigation. Swaps ONLY the center panel (Shop / Upgrades / Workers / Mobs)
// so the corner panels (Current Customer with Serve/Send Away, Battle Results) stay live on every
// tab. Owns visibility; content is rendered by panels.js. (Bestiary activated in Pass 4a.)
//
// LABELS ARE LOAD-BEARING: this bar is right-anchored and grows LEFTWARD into the customer panel,
// so a label's WIDTH is a layout decision (style.css's bottom-bar budget; LESSONS 2026-07-04).
// 'Bestiary' -> 'Mobs' on 2026-07-15 because the tab holds two sub-views now (Expeditions + Field
// Guide) and neither name alone was true — the short label also buys the bar ~46px of slack back.
// A SIXTH tab does NOT fit at any label length: measured 2026-07-15, it overlaps the customer
// panel in every fallback face. Redesign the bar before you add one.
const TABS = [
  { id: 'shop',     label: 'Shop' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'workers',  label: 'Workers' },
  { id: 'fame',     label: 'Fame' },
  { id: 'bestiary', label: 'Mobs' },
];

// Which center panel each tab shows. Tabs without an entry here don't swap the center.
// The 'bestiary' id is kept deliberately: it is internal, the panel is still #bestiary-panel, and
// renaming it would churn every consumer to buy nothing.
const PANEL_FOR = { shop: 'items-panel', upgrades: 'upgrades-panel', workers: 'workers-panel', fame: 'fame-panel', bestiary: 'bestiary-panel' };

let navRoot = null;          // kept for the attention hook below
let activeTab = 'shop';
let wantAttention = false;   // "a sale is blocked by empty stock right now" (set by panels.js)
let dirty = () => {};        // marks the UI dirty on a tab change — see setTab's tail for WHY a
                             // pure visibility swap needs a re-render (it no longer is one)

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

// Is a center panel currently showing? (`activeTab === null` IS the collapsed state — setTab's
// own contract.) The marketIsOpen() precedent: a pure read, so panels.js can ask rather than
// track. Consumers: the diorama's DOM overlays (the hire chip, Bob's bubble, Greg's bubble), which
// live ABOVE .shop-ui by z-order and would otherwise paint straight through an open panel.
export function isPanelOpen() { return activeTab !== null; }

// Open a specific tab from OUTSIDE the nav (e.g. the hire goal chip). FORCE-OPEN semantics:
// unlike a nav-button click, calling this with the already-active tab does nothing — external
// callers mean "show me this panel", never "toggle it" (setTab's collapse is a nav-click gesture).
export function openTab(tab) {
  if (!navRoot || tab === activeTab) return;
  setTab(navRoot, tab);
}

export function initNav(root, onDirty) {
  navRoot = root;
  dirty = typeof onDirty === 'function' ? onDirty : () => {};
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
  // A tab change USED to be a pure visibility swap that needed no re-render. It isn't any more:
  // the diorama's DOM overlays (hire chip / Bob's bubble / Greg's bubble) now gate on isPanelOpen(),
  // and panels.js only re-reads that on a render. Without this, opening a panel would leave an
  // overlay painted across it until the next unrelated uiDirty (a spawn, a serve — up to seconds).
  dirty();
}
