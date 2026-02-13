const STORAGE_KEY = 'g-storage-owned-v1';

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


  renderStats();
}

function findImagePath(id) {
  const baseId = normalizeId(id);
  const direct = `カードリスト/${baseId}.png`;
  const alt = `カードリスト/${baseId}ol.png`;
  const direct = `カードリスト/${id}.png`;
  const alt = `カードリスト/${id.replace(/ol$/, '')}ol.png`;
  return [direct, alt, 'カードリスト/裏面.png'];
}

function filterCards() {
  const kw = state.search.trim().toLowerCase();
  let list = state.cards.filter(card => {
    if (state.setCode && card.setCode !== state.setCode) return false;
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

function getDeckCount(deckMap) {
  return Object.values(deckMap).reduce((sum, v) => sum + Number(v || 0), 0);
}

function getAdvance2Count() {
  return Object.entries(state.deck.main).reduce((sum, [id, qty]) => {
    const card = cardById.get(id);
    return sum + ((card?.advance === 2) ? Number(qty || 0) : 0);
  }, 0);
}

function setDeckMessage(msg = '') {
  el.deckMessage.textContent = msg;
}

function addToKaijuDeck(card) {
  if (!String(card.type).includes('怪獣')) return setDeckMessage('怪獣デッキには怪獣カードのみ追加できます。');
  if (![1, 2, 3, 4].includes(Number(card.grade))) return setDeckMessage('怪獣デッキは等級1〜4のみです。');

  const currentEntries = Object.entries(state.deck.kaiju).filter(([, v]) => v > 0);
  if (currentEntries.some(([id]) => Number(cardById.get(id)?.grade) === Number(card.grade) && id !== card.id)) {
    return setDeckMessage(`等級${card.grade}は既に登録済みです。`);
  }
  if (state.deck.kaiju[card.id] >= 1) return setDeckMessage('同一カードは怪獣デッキに1枚までです。');
  if (getDeckCount(state.deck.kaiju) >= 4) return setDeckMessage('怪獣デッキは4枚までです。');

  state.deck.kaiju[card.id] = 1;
  saveDeck();
  setDeckMessage(`${card.name} を怪獣デッキに追加しました。`);
  renderDeck();
}

function addToMainDeck(card) {
  const total = getDeckCount(state.deck.main);
  if (total >= 50) return setDeckMessage('メインデッキは50枚までです。');

  const adv2 = getAdvance2Count();
  if (Number(card.advance) === 2 && adv2 >= 10) return setDeckMessage('進攻2カードは10枚以下です。');

  state.deck.main[card.id] = (state.deck.main[card.id] || 0) + 1;
  saveDeck();
  setDeckMessage(`${card.name} をメインデッキに追加しました。`);
  renderDeck();
}

function removeFromDeck(kind, id) {
  if (!state.deck[kind][id]) return;
  state.deck[kind][id] -= 1;
  if (state.deck[kind][id] <= 0) delete state.deck[kind][id];
  saveDeck();
  renderDeck();
}

function renderDeckList(target, deckMap, kind) {
  target.innerHTML = '';
  const entries = Object.entries(deckMap)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ card: cardById.get(id), qty }))
    .filter(entry => entry.card)
    .sort((a, b) => sortDeckCards(a.card, b.card));

  if (!entries.length) {
    const li = document.createElement('li');
    li.textContent = '未登録';
    target.appendChild(li);
    return;
  }

  entries.forEach(({ card, qty }) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>等級${card.grade} / ${card.color} / ${card.id} ${card.name} ×${qty}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'deck-remove';
    btn.textContent = '−1';
    btn.addEventListener('click', () => removeFromDeck(kind, card.id));
    li.appendChild(btn);
    target.appendChild(li);
  });
}

function renderDeck() {
  renderDeckList(el.kaijuDeckList, state.deck.kaiju, 'kaiju');
  renderDeckList(el.mainDeckList, state.deck.main, 'main');

  const kaijuTotal = getDeckCount(state.deck.kaiju);
  const mainTotal = getDeckCount(state.deck.main);
  const adv2 = getAdvance2Count();

  el.kaijuSummary.textContent = `${kaijuTotal}/4`;
  el.mainSummary.textContent = `${mainTotal}/50 (進攻2:${adv2}/10)`;
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
    image.addEventListener('click', () => {
      el.modalImage.src = image.currentSrc || image.src;
      el.imageModal.showModal();
    });

    node.querySelector('.card-title').textContent = card.name;
    node.querySelector('.card-id').textContent = card.id;
    node.querySelector('.meta').textContent = `${card.setCode} / ${card.color} / ${card.type} / 等級${card.grade ?? '-'} / ${card.power ?? 0}`;

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

    node.querySelector('.add-kaiju').addEventListener('click', () => addToKaijuDeck(card));
    node.querySelector('.add-main').addEventListener('click', () => addToMainDeck(card));

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
  el.setFilter.addEventListener('change', e => { state.setCode = e.target.value; render(); });
  el.colorFilter.addEventListener('change', e => { state.color = e.target.value; render(); });
  el.typeFilter.addEventListener('change', e => { state.type = e.target.value; render(); });
  el.gradeFilter.addEventListener('change', e => { state.grade = e.target.value; render(); });
  el.sortBy.addEventListener('change', e => { state.sortBy = e.target.value; render(); });

  el.resetFilters.addEventListener('click', () => {
    state.search = state.setCode = state.color = state.type = state.grade = '';
    state.sortBy = 'id';
    el.search.value = '';
    el.setFilter.value = '';
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
      version: 2,
      exportedAt: new Date().toISOString(),
      owned: state.owned,
      deck: state.deck
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
      state.owned = normalizeOwned(data.owned);
      state.deck = normalizeDeck(data.deck || {});
      saveOwned();
      saveDeck();
      render();
      renderDeck();
      state.owned = data.owned;
      save();
      render();
      alert('復元しました');
    } catch {
      alert('復元に失敗しました。JSON形式を確認してください。');
    }
    e.target.value = '';
  });

  el.clearDeckBtn.addEventListener('click', () => {
    state.deck = { kaiju: {}, main: {} };
    saveDeck();
    setDeckMessage('デッキを初期化しました。');
    renderDeck();
  });

  el.closeModal.addEventListener('click', () => el.imageModal.close());
  el.imageModal.addEventListener('click', e => {
    if (e.target === el.imageModal) el.imageModal.close();
  });
}

initFilters();
bindEvents();
render();
renderDeck();
