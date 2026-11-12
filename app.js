'use strict';

const letters = 'BINGO';
const size = 5;
const freeIndex = 12;
const ballCount = 75;
const columnSize = 15;
const storageKey = 'bingo75-v1';
const positions = Array.from({ length: size }, (_, index) => index);
const lines = [
  ...positions.map(row => positions.map(col => row * size + col)),
  ...positions.map(col => positions.map(row => row * size + col)),
  positions.map(index => index * (size + 1)),
  positions.map(index => (index + 1) * (size - 1))
];
const byId = id => document.getElementById(id);
const synth = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  ? window.speechSynthesis
  : null;
let speechRequest = 0;
let storageAvailable = true;

function newCard() {
  const card = Array(size * size).fill(null);
  for (const col of positions) {
    const pool = Array.from({ length: columnSize }, (_, i) => col * columnSize + i + 1);
    for (const row of positions) {
      const index = row * size + col;
      if (index !== freeIndex) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        card[index] = pool.splice(randomIndex, 1)[0];
      }
    }
  }
  return card;
}

function validCard(card) {
  return Array.isArray(card) && card.length === size * size &&
    card[freeIndex] === null && new Set(card).size === card.length &&
    card.every((number, index) => {
      const col = index % size;
      return index === freeIndex || (Number.isInteger(number) &&
        number > col * columnSize && number <= (col + 1) * columnSize);
    });
}

function loadState() {
  let saved;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    storageAvailable = false;
  }
  let data;
  try {
    data = JSON.parse(saved || 'null') || {};
  } catch {
    data = {};
  }
  const hasCard = validCard(data.card);
  return {
    card: hasCard ? data.card : newCard(),
    marks: new Set(hasCard && Array.isArray(data.marks)
      ? data.marks.filter(i => Number.isInteger(i) && i >= 0 && i < size * size && i !== freeIndex)
      : []),
    draws: Array.isArray(data.draws)
      ? [...new Set(data.draws.filter(n => Number.isInteger(n) && n >= 1 && n <= ballCount))]
      : [],
    mode: data.mode === 'host' ? 'host' : 'player',
    voice: data.voice === true
  };
}

const state = loadState();

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...state, marks: [...state.marks] }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  byId('storage-status').textContent = storageAvailable
    ? 'บันทึกการเล่นบนอุปกรณ์นี้โดยอัตโนมัติ'
    : 'เบราว์เซอร์ไม่อนุญาตให้บันทึก การเล่นจะอยู่จนกว่าจะปิดหรือโหลดหน้านี้ใหม่';
}

function renderMode() {
  for (const mode of ['player', 'host']) {
    const active = state.mode === mode;
    byId(mode).hidden = !active;
    byId(mode + '-mode').setAttribute('aria-pressed', active);
  }
}

function renderBoard() {
  const cells = state.card.map((number, index) => {
    if (index === freeIndex) {
      const free = document.createElement('span');
      free.className = 'cell free';
      free.textContent = 'FREE';
      free.setAttribute('aria-label', 'FREE ช่องฟรี นับให้อัตโนมัติ');
      return free;
    }

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.textContent = number;
    cell.setAttribute('aria-label', letters[index % size] + ' ' + number);
    cell.addEventListener('click', () => {
      if (state.marks.has(index)) state.marks.delete(index);
      else state.marks.add(index);
      renderMarks();
      save();
    });
    return cell;
  });
  byId('board').replaceChildren(...cells);
  renderMarks();
}

function renderMarks() {
  const wins = lines.filter(line => line.every(index => index === freeIndex || state.marks.has(index)));
  const winningCells = new Set(wins.flat());
  Array.from(byId('board').children).forEach((cell, index) => {
    if (index !== freeIndex) cell.setAttribute('aria-pressed', state.marks.has(index));
    cell.classList.toggle('winning', winningCells.has(index));
  });
  const status = byId('card-status');
  status.classList.toggle('won', wins.length > 0);
  status.textContent = wins.length
    ? 'BINGO! ครบ ' + wins.length + ' แนว'
    : 'ทำเครื่องหมายแล้ว ' + (state.marks.size + 1) + ' จาก 25 ช่อง (รวม FREE)';
  byId('clear-marks').disabled = state.marks.size === 0;
}

function letterIndex(number) {
  return Math.floor((number - 1) / columnSize);
}

function ballLabel(number) {
  return letters[letterIndex(number)] + ' ' + number;
}

function renderHost() {
  const count = state.draws.length;
  byId('latest').textContent = count ? ballLabel(state.draws[count - 1]) : '—';
  byId('draw-count').textContent = 'ออกแล้ว ' + count + ' / 75 ลูก';
  byId('draw').disabled = count === ballCount;
  byId('draw').textContent = count === ballCount ? 'สุ่มครบ 75 ลูกแล้ว' : 'สุ่มเลขถัดไป';
  byId('reset-draw').disabled = count === 0;
  byId('history-empty').hidden = count > 0;
  byId('voice').disabled = !synth;
  byId('voice').checked = Boolean(synth && state.voice);
  byId('repeat').disabled = !synth || count === 0;
  const items = [...state.draws].reverse().map(number => {
    const item = document.createElement('li');
    item.textContent = ballLabel(number);
    return item;
  });
  byId('history').replaceChildren(...items);
}

function voiceStatus(message) {
  const status = byId('voice-status');
  status.textContent = message;
  status.hidden = !message;
}

function stopSpeech() {
  speechRequest += 1;
  if (synth) synth.cancel();
}

function thaiNumber(number) {
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  if (number < 10) return digits[number];
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  const prefix = tens === 1 ? '' : tens === 2 ? 'ยี่' : digits[tens];
  return prefix + 'สิบ' + (ones === 1 ? 'เอ็ด' : ones === 0 ? '' : digits[ones]);
}

function speak(number) {
  if (!synth || !number) return;
  stopSpeech();
  const request = speechRequest;
  const voices = synth.getVoices();
  const voice = voices.find(item => /^th(?:[-_]|$)/i.test(item.lang));
  if (voices.length && !voice) {
    voiceStatus('ไม่พบเสียงภาษาไทยในอุปกรณ์นี้');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(
    ['บี', 'ไอ', 'เอ็น', 'จี', 'โอ'][letterIndex(number)] + ' ' + thaiNumber(number)
  );
  utterance.lang = 'th-TH';
  if (voice) utterance.voice = voice;
  utterance.onerror = () => {
    if (request === speechRequest) voiceStatus('เล่นเสียงไม่ได้ในขณะนี้');
  };
  voiceStatus('');
  synth.speak(utterance);
}

for (const mode of ['player', 'host']) {
  byId(mode + '-mode').addEventListener('click', () => {
    state.mode = mode;
    if (mode === 'player') stopSpeech();
    renderMode();
    save();
  });
}

byId('new-card').addEventListener('click', () => {
  if (state.marks.size && !window.confirm('สุ่มบัตรใหม่และล้างเครื่องหมายบนบัตรเดิมหรือไม่?')) return;
  state.card = newCard();
  state.marks.clear();
  renderBoard();
  save();
});

byId('clear-marks').addEventListener('click', () => {
  if (!window.confirm('ล้างเครื่องหมายทั้งหมดบนบัตรนี้หรือไม่?')) return;
  state.marks.clear();
  renderMarks();
  byId('new-card').focus();
  save();
});

byId('draw').addEventListener('click', () => {
  const drawn = new Set(state.draws);
  const available = Array.from({ length: ballCount }, (_, i) => i + 1).filter(n => !drawn.has(n));
  if (available.length === 0) return;
  const number = available[Math.floor(Math.random() * available.length)];
  state.draws.push(number);
  renderHost();
  save();
  if (state.voice) speak(number);
});

byId('reset-draw').addEventListener('click', () => {
  if (!window.confirm('เริ่มรอบใหม่และล้างประวัติเลขที่สุ่มแล้วหรือไม่?')) return;
  state.draws = [];
  stopSpeech();
  if (synth) voiceStatus('');
  renderHost();
  byId('draw').focus();
  save();
});

byId('voice').addEventListener('change', event => {
  state.voice = event.target.checked;
  if (!state.voice) stopSpeech();
  voiceStatus('');
  save();
});
byId('repeat').addEventListener('click', () => speak(state.draws[state.draws.length - 1]));

renderMode();
renderBoard();
renderHost();
if (!synth) voiceStatus('เบราว์เซอร์นี้ไม่รองรับการอ่านเลขออกเสียง');
else synth.getVoices();
save();

if (window.isSecureContext && location.protocol !== 'file:' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('ติดตั้งการเล่นออฟไลน์ไม่สำเร็จ', error);
  });
}
