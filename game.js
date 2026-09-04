"use strict";

// --- Rastergeometrie: muss zu den Werten in style.css (--grid-*) passen ---
const GRID_COLS = 25;
const GRID_ROWS = 19;
const GRID_LEFT = 6.1564;   // % - linker Rand von Spalte x=1
const GRID_TOP = 5.5623;    // % - oberer Rand von Zeile y=1
const CELL_W = 3.3672;      // % Breite pro Spalte
const CELL_H = 4.7630;      // % Höhe pro Zeile

const RADIUS = 5;           // Einflussradius (in Rasterzellen) für die Punktevergabe
const NUM_FLAGS = 3;

// Fundorte aus den Original-Materialien (cards.pdf), als Basis-Deck
const ORIGINAL_GOLD = [
  [2, 3], [3, 6], [4, 7], [5, 6], [6, 5], [9, 8], [2, 15], [10, 17],
  [11, 16], [12, 15], [13, 18], [16, 3], [21, 1], [18, 15], [19, 12],
  [20, 14], [22, 13], [22, 15], [23, 12], [24, 14]
];

// --- DOM-Referenzen ---
const boardEl = document.getElementById("board");
const markerLayer = document.getElementById("markerLayer");
const flagPool = document.getElementById("flagPool");
const flagTray = document.getElementById("flagTray");
const deckStack = document.getElementById("deckStack");
const deckCount = document.getElementById("deckCount");
const currentCard = document.getElementById("currentCard");
const cardXEl = document.getElementById("cardX");
const cardYEl = document.getElementById("cardY");
const loginBtn = document.getElementById("loginBtn");
const newGameBtn = document.getElementById("newGameBtn");
const resultBlock = document.getElementById("resultBlock");
const flagScoresEl = document.getElementById("flagScores");
const totalScoreEl = document.getElementById("totalScore");
const maxScoreEl = document.getElementById("maxScore");
const totalPercentEl = document.getElementById("totalPercent");

// --- Spielzustand ---
let goldSet = [];       // aktuelle Fundorte [{x,y}, ...]
let deck = [];          // gemischte Kartenreihenfolge
let deckIndex = 0;
let tempGoldMarkerEl = null;   // temporär sichtbarer Fund (verschwindet bei nächster Karte)
let flags = [];         // {id, el, x|null, y|null}
let locked = false;     // true nach "Einloggen", bis neues Spiel gestartet wird

// --- Hilfsfunktionen: Koordinaten <-> Prozentpositionen ---
function cellCenterPercent(x, y) {
  return {
    left: GRID_LEFT + (x - 0.5) * CELL_W,
    top: GRID_TOP + (y - 0.5) * CELL_H
  };
}

// Wandelt eine Pointer-Position (relativ zum Board) in Rasterkoordinaten um, oder null falls außerhalb
function pointToGrid(clientX, clientY) {
  const rect = boardEl.getBoundingClientRect();
  const px = ((clientX - rect.left) / rect.width) * 100;
  const py = ((clientY - rect.top) / rect.height) * 100;
  const x = Math.round((px - GRID_LEFT) / CELL_W + 0.5);
  const y = Math.round((py - GRID_TOP) / CELL_H + 0.5);
  if (x < 1 || x > GRID_COLS || y < 1 || y > GRID_ROWS) return null;
  return { x, y };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Kartenstapel ---
function clearTempGoldMarker() {
  if (tempGoldMarkerEl) {
    tempGoldMarkerEl.remove();
    tempGoldMarkerEl = null;
  }
}

function drawNextCard() {
  if (locked || deckIndex >= deck.length) return;
  clearTempGoldMarker();

  const card = deck[deckIndex];
  deckIndex++;

  cardXEl.textContent = card[0];
  cardYEl.textContent = card[1];
  currentCard.hidden = false;

  const pos = cellCenterPercent(card[0], card[1]);
  tempGoldMarkerEl = document.createElement("div");
  tempGoldMarkerEl.className = "marker gold-marker temp";
  tempGoldMarkerEl.style.left = pos.left + "%";
  tempGoldMarkerEl.style.top = pos.top + "%";
  tempGoldMarkerEl.innerHTML = '<img src="assets/gold_icon.png" alt="Gold">';
  markerLayer.appendChild(tempGoldMarkerEl);

  deckCount.textContent = `${deckIndex} / ${deck.length}`;
  if (deckIndex >= deck.length) {
    loginBtn.disabled = false;
  }
}

deckStack.addEventListener("click", drawNextCard);

// --- Fähnchen: Drag & Drop per Pointer Events ---
function createFlagElements() {
  flagPool.innerHTML = "";
  flags = [];
  for (let i = 0; i < NUM_FLAGS; i++) {
    const el = document.createElement("div");
    el.className = "flag";
    el.textContent = "🚩";
    el.dataset.id = String(i);
    flagPool.appendChild(el);
    const flag = { id: i, el, x: null, y: null };
    flags.push(flag);
    attachDragHandlers(flag);
  }
}

function attachDragHandlers(flag) {
  flag.el.addEventListener("pointerdown", (e) => {
    if (locked) return;
    e.preventDefault();
    flag.el.setPointerCapture(e.pointerId);
    flag.el.style.position = "fixed";
    flag.el.style.zIndex = "1000";
    flag.el.style.left = e.clientX + "px";
    flag.el.style.top = e.clientY + "px";
    flag.el.style.transform = "translate(-50%, -100%)";
    document.body.appendChild(flag.el);

    const onMove = (ev) => {
      flag.el.style.left = ev.clientX + "px";
      flag.el.style.top = ev.clientY + "px";
    };
    const onUp = (ev) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      placeFlagFromPointer(flag, ev.clientX, ev.clientY);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

function placeFlagFromPointer(flag, clientX, clientY) {
  const grid = pointToGrid(clientX, clientY);
  if (grid) {
    flag.x = grid.x;
    flag.y = grid.y;
    const pos = cellCenterPercent(grid.x, grid.y);
    flag.el.style.position = "absolute";
    flag.el.style.zIndex = "";
    flag.el.style.left = pos.left + "%";
    flag.el.style.top = pos.top + "%";
    markerLayer.appendChild(flag.el);
  } else {
    // außerhalb des Spielfelds abgelegt -> zurück in den Vorrat
    flag.x = null;
    flag.y = null;
    flag.el.style.position = "static";
    flag.el.style.zIndex = "";
    flag.el.style.left = "";
    flag.el.style.top = "";
    flag.el.style.transform = "none";
    flagPool.appendChild(flag.el);
  }
}

// --- Punkteberechnung ---
function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function scoreAt(x, y) {
  let s = 0;
  for (const [gx, gy] of goldSet) {
    s += Math.max(0, RADIUS - dist(x, y, gx, gy));
  }
  return s;
}

function computeMaxScore() {
  const scores = [];
  for (let x = 1; x <= GRID_COLS; x++) {
    for (let y = 1; y <= GRID_ROWS; y++) {
      scores.push(scoreAt(x, y));
    }
  }
  scores.sort((a, b) => b - a);
  return scores.slice(0, NUM_FLAGS).reduce((a, b) => a + b, 0);
}

function showAllGold() {
  for (const [gx, gy] of goldSet) {
    const pos = cellCenterPercent(gx, gy);
    const el = document.createElement("div");
    el.className = "marker gold-marker";
    el.style.left = pos.left + "%";
    el.style.top = pos.top + "%";
    el.innerHTML = '<img src="assets/gold_icon.png" alt="Gold">';
    markerLayer.appendChild(el);
  }
}

function login() {
  if (locked || deckIndex < deck.length) return;
  clearTempGoldMarker();
  showAllGold();

  let total = 0;
  flagScoresEl.innerHTML = "";
  flags.forEach((flag, i) => {
    const s = (flag.x !== null) ? scoreAt(flag.x, flag.y) : 0;
    total += s;
    const li = document.createElement("li");
    li.textContent = (flag.x !== null)
      ? `Fähnchen ${i + 1} (${flag.x}|${flag.y}): ${s.toFixed(1)} Punkte`
      : `Fähnchen ${i + 1}: nicht platziert (0 Punkte)`;
    flagScoresEl.appendChild(li);
  });

  const max = computeMaxScore();
  totalScoreEl.textContent = total.toFixed(1);
  maxScoreEl.textContent = max.toFixed(1);
  totalPercentEl.textContent = max > 0 ? Math.round((total / max) * 100) : 0;

  resultBlock.hidden = false;
  loginBtn.disabled = true;
  locked = true;
}

loginBtn.addEventListener("click", login);

// --- Neues, geclustertes Zufallsspiel erzeugen ---
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Grob normalverteilte Zufallszahl (Summe zweier Uniform-Werte) für "natürlichere" Cluster-Streuung
function jitter(spread) { return (Math.random() + Math.random() - 1) * spread; }

function generateClusteredGold(totalPoints = 20, minClusters = 6, maxClusters = 8) {
  const numClusters = randInt(minClusters, maxClusters);
  const centers = [];
  const minCenterDist = 4; // Cluster sollen sich nicht zu stark überlappen
  let attempts = 0;
  while (centers.length < numClusters && attempts < 500) {
    attempts++;
    const c = { x: randInt(2, GRID_COLS - 1), y: randInt(2, GRID_ROWS - 1) };
    if (centers.every(o => dist(o.x, o.y, c.x, c.y) >= minCenterDist)) {
      centers.push(c);
    }
  }

  // Punkte gleichmäßig auf Cluster verteilen (Rest auf die ersten Cluster)
  const counts = new Array(centers.length).fill(Math.floor(totalPoints / centers.length));
  for (let i = 0; i < totalPoints % centers.length; i++) counts[i]++;

  const used = new Set();
  const points = [];
  centers.forEach((c, idx) => {
    let placed = 0;
    let tries = 0;
    while (placed < counts[idx] && tries < 200) {
      tries++;
      const x = Math.min(GRID_COLS, Math.max(1, Math.round(c.x + jitter(2.2))));
      const y = Math.min(GRID_ROWS, Math.max(1, Math.round(c.y + jitter(2.2))));
      const key = x + "_" + y;
      if (!used.has(key)) {
        used.add(key);
        points.push([x, y]);
        placed++;
      }
    }
  });
  return points;
}

// --- Spiel (neu) initialisieren ---
function initGame(gold) {
  goldSet = gold;
  deck = shuffle(gold);
  deckIndex = 0;
  locked = false;

  markerLayer.innerHTML = "";
  clearTempGoldMarker();
  currentCard.hidden = true;
  deckCount.textContent = `0 / ${deck.length}`;
  loginBtn.disabled = true;
  resultBlock.hidden = true;

  createFlagElements();
}

newGameBtn.addEventListener("click", () => {
  initGame(generateClusteredGold());
});

// Start mit dem Original-Kartensatz aus den bereitgestellten Materialien
initGame(ORIGINAL_GOLD);
