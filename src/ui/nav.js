// nav.js — bottom navigation. Swaps ONLY the center panel (Shop <-> Upgrades) so the corner panels
// (Current Customer with Serve/Send Away, Battle Results) stay live on every tab. Owns visibility;
// content is rendered by panels.js. Workers/Bestiary are disabled stubs until M4+.
const TABS = [
  { id: 'shop',     label: 'Shop' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'workers',  label: 'Workers',  disabled: true },
  { id: 'bestiary', label: 'Bestiary', disabled: true },
];

// Which center panel each tab shows. Tabs without an entry here don't swap the center.
const PANEL_FOR = { shop: 'items-panel', upgrades: 'upgrades-panel' };

export function initNav(root) {
  root.innerHTML = TABS.map((t) => {
    const soon = t.disabled ? '<span class="nav-soon">soon</span>' : '';
    const dis = t.disabled ? ' disabled title="Coming soon"' : '';
    return `<button class="nav-btn" data-tab="${t.id}"${dis}>${t.label}${soon}</button>`;
  }).join('');

  root.querySelectorAll('.nav-btn').forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => setTab(root, btn.dataset.tab));
  });
  setTab(root, 'shop');
}

function setTab(root, tab) {
  // Show the chosen center panel, hide the others.
  for (const panelId of Object.values(PANEL_FOR)) {
    const el = document.getElementById(panelId);
    if (el) el.classList.toggle('hidden', PANEL_FOR[tab] !== panelId);
  }
  root.querySelectorAll('.nav-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.tab === tab));
}
