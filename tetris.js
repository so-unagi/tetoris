const keys = {
  ArrowLeft: { pressed: false, delay: 0 },
  ArrowRight: { pressed: false, delay: 0 }
};
let lockDelay = 300;
let lockTimer = 0;
let isLocking = false;
let ren = -1; // 初期値 -1（Tetris Guideline に準拠）
const keyRepeatDelay = 150;
const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
ctx.scale(20, 20);
nextCtx.scale(20, 20);
holdCtx.scale(20, 20);

const colors = [
  null,            // 0: 空白
  '#A000F0',       // 1: T (紫)
  '#F0F000',       // 2: O (黄色)
  '#F0A000',       // 3: L (オレンジ)
  '#0000F0',       // 4: J (青)
  '#00F0F0',       // 5: I (水色)
  '#00F000',       // 6: S (緑)
  '#F00000'        // 7: Z (赤)
];

const pieces = 'TOLJISZ';
const arena = createMatrix(10, 20);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
  rotation: 0,
  lastMove: null,
  type: null,
  hold: null,
  canHold: true
};

const NEXT_COUNT = 5;
const nextQueue = [];
function initNextQueue() {
  while (nextQueue.length < 5) {
    nextQueue.push(getNextPieceFromBag());
  }
}
function refillNextQueue() {
  while (nextQueue.length < 5) {
    nextQueue.push(getNextPieceFromBag());
  }
}

let highscore = parseInt(localStorage.getItem('tetrisHigh') || '0');
highEl.textContent = highscore;

function createMatrix(w, h) {
  const m = [];
  while (h--) m.push(new Array(w).fill(0));
  return m;
}

function createPiece(type) {
  if (type === 'I') return [[0, 0, 0, 0], [5, 5, 5, 5]];
  if (type === 'J') return [[4, 0, 0], [4, 4, 4]];
  if (type === 'L') return [[0, 0, 3], [3, 3, 3]];
  if (type === 'O') return [[2, 2], [2, 2]];
  if (type === 'S') return [[0, 6, 6], [6, 6, 0]];
  if (type === 'T') return [[0, 1, 0], [1, 1, 1]];
  if (type === 'Z') return [[7, 7, 0], [0, 7, 7]];
}


function drawMatrix(m, offset) {
  m.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        ctx.fillStyle = colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function drawGrid() {
  ctx.strokeStyle = '#777'; // グレー線
  ctx.lineWidth = 0.05;
  for (let x = 0; x <= 10; x++) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 20);
    ctx.stroke();
  }
  for (let y = 0; y <= 20; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(10, y);
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  drawMatrix(arena, { x: 0, y: 0 });
  drawGhost();
  drawMatrix(player.matrix, player.pos);
}
function drawGhost() {
  const ghostPos = { x: player.pos.x, y: player.pos.y };


  while (!collide(arena, { ...player, pos: ghostPos })) {
    ghostPos.y++;
  }
  ghostPos.y--;

  ctx.globalAlpha = 0.3;
  drawMatrix(player.matrix, ghostPos);
  ctx.globalAlpha = 1.0;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (
        m[y][x] !== 0 &&
        (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y >= 0; y--) {
    for (let x = 0; x < arena[y].length; x++) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    player.score += rowCount * 10;
    rowCount *= 2;
    y++;
  }
  scoreEl.textContent = player.score;
  if (player.score > highscore) {
    highscore = player.score;
    highEl.textContent = highscore;
    localStorage.setItem('tetrisHigh', highscore);
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;

    if (!isLocking) {
      isLocking = true;
      lockTimer = 0;
    }
  } else {
    isLocking = false;
  }

  dropCounter = 0;
  player.lastMove = 'drop';
}


function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
  isLocking = false;
  player.lastMove = 'move';
}

function rotate(matrix, dir) {
  const N = matrix.length;
  const M = matrix[0].length;
  const result = [];
  for (let y = 0; y < M; y++) {
    result[y] = [];
    for (let x = 0; x < N; x++) {
      if (dir > 0) {
        result[y][x] = matrix[N - 1 - x][y];
      } else {
        result[y][x] = matrix[x][M - 1 - y];
      }
    }
  }
  matrix.length = 0;
  result.forEach(row => matrix.push(row));
}

// SRSキックテーブル (JLSTZ)
function getKickTable(type, from, to) {
  const JLSTZ = {
    '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  return JLSTZ[`${from}->${to}`] || [[0, 0]];
}

function playerRotate(dir) {
  const oldRotation = player.rotation;
  const newRotation = (oldRotation + dir + 4) % 4;
  const kicks = getKickTable(player.type, oldRotation, newRotation);

  const originalMatrix = JSON.parse(JSON.stringify(player.matrix));

  rotate(player.matrix, dir);

  for (const [dx, dy] of kicks) {
    player.pos.x += dx;
    player.pos.y += dy;
    if (!collide(arena, player)) {
      player.rotation = newRotation;
      player.lastMove = 'rotate';
      checkTSpin();
      return;
    }
    player.pos.x -= dx;
    player.pos.y -= dy;
  }
  isLocking = false;
  player.matrix = originalMatrix;
}
let bag = [];
function refillBag() {
  const types = ['T', 'J', 'L', 'O', 'S', 'Z', 'I'];

  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  bag.push(...types);
}
function getNextPieceFromBag() {
  if (bag.length === 0) {
    refillBag();
  }
  return bag.shift();
}

function playerReset() {
  const pieceType = nextQueue.shift();
  refillNextQueue();

  player.matrix = createPiece(pieceType);
  player.type = pieceType;
  player.rotation = 0;
  player.pos.y = 0;
  player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);

  if (collide(arena, player)) {

    arena.forEach(row => row.fill(0));
    alert('ゲームオーバー');
    player.score = 0;
    scoreEl.textContent = 0;
    initNextQueue();
    playerReset();
  }
  drawNext();
  drawHold();
}


function createNextQueue() {
  nextQueue.length = 0;
  for (let i = 0; i < NEXT_COUNT; i++) {
    nextQueue.push(randomPiece());
  }
}

function randomPiece() {
  return pieces[Math.floor(Math.random() * pieces.length)];
}


function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextQueue.forEach((type, index) => {
    const matrix = createPiece(type);
    const colorIndex = pieces.indexOf(type) + 1;
    const offset = { x: 1, y: index * 4 + 1 };

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          nextCtx.fillStyle = colors[colorIndex];
          nextCtx.fillRect(x + offset.x, y + offset.y, 1, 1);
        }
      });
    });
  });
}


function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

  if (!player.hold) return;

  const matrix = createPiece(player.hold);
  const colorIndex = pieces.indexOf(player.hold) + 1;


  const offsetX = Math.floor((4 - matrix[0].length) / 2);
  const offsetY = Math.floor((4 - matrix.length) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        holdCtx.fillStyle = colors[colorIndex];
        holdCtx.fillRect(x + offsetX, y + offsetY, 1, 1);
      }
    });
  });
}


function holdPiece() {
  if (!player.canHold) return;
  const currentType = player.type;

  if (!player.hold) {
    player.hold = currentType;
    playerReset();
  } else {
    const temp = player.hold;
    player.hold = currentType;
    player.matrix = createPiece(temp);
    player.type = temp;
    player.rotation = 0;
    player.pos.y = 0;
    player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);

    if (collide(arena, player)) {
      arena.forEach(row => row.fill(0));
      alert('ゲームオーバー');
      player.score = 0;
      scoreEl.textContent = 0;
      createNextQueue();
      playerReset();
    }
  }
  player.canHold = false;
  drawHold();
}

function checkTSpin() {
  if (player.type !== 'T' || player.lastMove !== 'rotate') {
    lastMoveWasRotate = false;
    return;
  }

  const { x, y } = player.pos;
  const corners = [
    [x, y],             // 左上
    [x + 2, y],         // 右上
    [x, y + 2],         // 左下
    [x + 2, y + 2],     // 右下
  ];

  let occupied = 0;
  for (const [cx, cy] of corners) {
    if (
      cy < 0 || cy >= arena.length ||
      cx < 0 || cx >= arena[0].length ||
      arena[cy][cx] !== 0
    ) {
      occupied++;
    }
  }

  lastMoveWasRotate = occupied >= 3;
}

let dropCounter = 0;
let dropInterval = 1000;

let lastTime = 0;
function hardDrop() {
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  arenaSweep();
  playerReset();
  dropCounter = 0;
  player.canHold = true;
  player.lastMove = 'hardDrop';
}
document.addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft') {
    if (!keys.ArrowLeft.pressed) {
      playerMove(-1);
    }
    keys.ArrowLeft.pressed = true;
  } else if (e.code === 'ArrowRight') {
    if (!keys.ArrowRight.pressed) {
      playerMove(1);
    }
    keys.ArrowRight.pressed = true;
  } else if (e.code === 'ArrowDown') {
    playerDrop();
  } else if (e.code === 'KeyC') {
    playerRotate(1);
  } else if (e.code === 'KeyZ') {
    playerRotate(-1); // ←★ これを追加！
  } else if (e.code === 'KeyX') {
    holdPiece();
  } else if (e.code === 'ArrowUp') {
    hardDrop();
  }
});
document.addEventListener('keyup', e => {
  if (e.code in keys) {
    keys[e.code].pressed = false;
    keys[e.code].delay = 0;
  }
});

createNextQueue();
initNextQueue();
playerReset();
update();

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (isLocking) {
    lockTimer += delta;
    if (lockTimer > lockDelay) {
      merge(arena, player);
      arenaSweep();
      playerReset();
      player.canHold = true;
      isLocking = false;
    }
  }


  for (const key in keys) {
    if (keys[key].pressed) {
      keys[key].delay += delta;
      if (keys[key].delay > keyRepeatDelay) {
        keys[key].delay = 0;
        if (key === 'ArrowLeft') playerMove(-1);
        if (key === 'ArrowRight') playerMove(1);
      }
    }
  }

  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  requestAnimationFrame(update);
}
