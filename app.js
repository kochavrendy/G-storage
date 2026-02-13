const STORAGE_KEY = 'g-storage-owned-v1';

const state = {
  cards: Object.values(window.CARD_META || {}),
  owned: JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
  search: '',
  color: '',
  type: '',
  grade: '',
  sortBy: 'id'
};

const el = {
  search: document.getElementById('search'),
  colorFilter: document.getElementById('colorFilter'),
  typeFilter: document.getElementById('typeFilter'),
  gradeFilter: document.getElementById('gradeFilter'),
  sortBy: document.getElementById('sortBy'),
  resetFilters: document.getElementById('resetFilters'),
  cardGrid: document.getElementById('cardGrid'),
  cardTemplate: document.getElementById('cardTemplate'),
  resultsInfo: document.getElementById('resultsInfo'),
  totalCards: document.getElementById('totalCards'),
  ownedKinds: document.getElementById('ownedKinds'),
  ownedCopies: document.getElementById('ownedCopies'),
  completion: document.getElementById('completion'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput')
};

function initFilters() {
  fillSelect(el.colorFilter, unique(state.cards.map(c => c.color)).sort());
  fillSelect(el.typeFilter, unique(state.cards.map(c => c.type)).sort());
  fillSelect(el.gradeFilter, unique(state.cards.map(c => c.grade).filter(Boolean)).sort((a, b) => a - b));
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function fillSelect(select, values) {
  values.forEach(v => {
    const option = document.createElement('option');
    option.value = String(v);
    option.textContent = String(v);
    select.appendChild(option);
  });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.owned));
}

function setOwned(id, qty) {
  state.owned[id] = Math.max(0, Number(qty) || 0);
  if (state.owned[id] === 0) delete state.owned[id];
  save();
  renderStats();
}

function findImagePath(id) {
  const direct = `カードリスト/${id}.png`;
  const alt = `カードリスト/${id.replace(/ol$/, '')}ol.png`;
  return [direct, alt, 'カードリスト/裏面.png'];
}

function filterCards() {
  const kw = state.search.trim().toLowerCase();
  let list = state.cards.filter(card => {
    if (state.color && card.color !== state.color) return false;
    if (state.type && card.type !== state.type) return false;
    if (state.grade && String(card.grade) !== state.grade) return false;
    if (!kw) return true;
    const hay = `${card.id} ${card.name} ${card.features_raw || ''}`.toLowerCase();
    return hay.includes(kw);
  });

  list.sort((a, b) => {
    if (state.sortBy === 'name') return a.name.localeCompare(b.name, 'ja');
    if (state.sortBy === 'power') return (b.power || 0) - (a.power || 0);
    if (state.sortBy === 'owned') return (state.owned[b.id] || 0) - (state.owned[a.id] || 0);
    return a.id.localeCompare(b.id, 'ja');
  });

  return list;
}

function render() {
  const cards = filterCards();
  el.resultsInfo.textContent = `${cards.length} 件`;
  el.cardGrid.innerHTML = '';

  const frag = document.createDocumentFragment();
  cards.forEach(card => {
    const node = el.cardTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector('.card-image');
    const [direct, alt, fallback] = findImagePath(card.id);
    image.src = direct;
    image.alt = `${card.name} (${card.id})`;
    image.onerror = () => {
      if (image.src.endsWith(encodeURI(direct))) image.src = alt;
      else image.src = fallback;
      image.onerror = null;
    };

    node.querySelector('.card-title').textContent = `${card.name} [${card.id}]`;
    node.querySelector('.meta').textContent = `${card.color} / ${card.type} / 等級${card.grade ?? '-'} / ${card.power ?? 0}`;
    node.querySelector('.text').textContent = card.text || 'テキストなし';

    const qtyInput = node.querySelector('.qty');
    qtyInput.value = state.owned[card.id] || 0;
    qtyInput.addEventListener('change', () => {
      setOwned(card.id, qtyInput.value);
      qtyInput.value = state.owned[card.id] || 0;
    });

    node.querySelector('.plus').addEventListener('click', () => {
      setOwned(card.id, (state.owned[card.id] || 0) + 1);
      qtyInput.value = state.owned[card.id] || 0;
    });

    node.querySelector('.minus').addEventListener('click', () => {
      setOwned(card.id, (state.owned[card.id] || 0) - 1);
      qtyInput.value = state.owned[card.id] || 0;
    });

    frag.appendChild(node);
  });

  el.cardGrid.appendChild(frag);
  renderStats();
}

function renderStats() {
  const total = state.cards.length;
  const ownedEntries = Object.entries(state.owned);
  const kinds = ownedEntries.filter(([, v]) => v > 0).length;
  const copies = ownedEntries.reduce((sum, [, v]) => sum + Number(v || 0), 0);
  const completion = total ? Math.round((kinds / total) * 1000) / 10 : 0;

  el.totalCards.textContent = String(total);
  el.ownedKinds.textContent = String(kinds);
  el.ownedCopies.textContent = String(copies);
  el.completion.textContent = `${completion}%`;
}

function bindEvents() {
  el.search.addEventListener('input', e => { state.search = e.target.value; render(); });
  el.colorFilter.addEventListener('change', e => { state.color = e.target.value; render(); });
  el.typeFilter.addEventListener('change', e => { state.type = e.target.value; render(); });
  el.gradeFilter.addEventListener('change', e => { state.grade = e.target.value; render(); });
  el.sortBy.addEventListener('change', e => { state.sortBy = e.target.value; render(); });

  el.resetFilters.addEventListener('click', () => {
    state.search = state.color = state.type = state.grade = '';
    state.sortBy = 'id';
    el.search.value = '';
    el.colorFilter.value = '';
    el.typeFilter.value = '';
    el.gradeFilter.value = '';
    el.sortBy.value = 'id';
    render();
  });

  el.exportBtn.addEventListener('click', () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      owned: state.owned
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `g-storage-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el.importInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.owned || typeof data.owned !== 'object') throw new Error('invalid');
      state.owned = data.owned;
      save();
      render();
      alert('復元しました');
    } catch {
      alert('復元に失敗しました。JSON形式を確認してください。');
    }
    e.target.value = '';
  });
}

initFilters();
bindEvents();
render();
