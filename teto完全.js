// 完全修正版 tetris.js
// SRS対応 + Tスピン判定 + TD砲（Tスピンダブル）対応

// --- 設定・状態管理変数 ---
const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
ctx.scale(20, 20);

const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
let highscore = parseInt(localStorage.getItem('tetrisHigh') || '0');
highEl.textContent = highscore;

const arena = createMatrix(10, 20);
const colors = [null, '#A000F0', '#F0F000', '#F0A000', '#0000F0', '#00F0F0', '#00F000', '#F00000'];
const pieces = 'TOLJISZ';

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0,
    rotation: 0,
    type: null,
    lastMove: null,
};

let lastMoveWasRotate = false;

// --- 初期化 ---
playerReset();
update();

function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function createPiece(type) {
    switch (type) {
        case 'T': return [[0, 1, 0], [1, 1, 1]];
        case 'O': return [[2, 2], [2, 2]];
        case 'L': return [[0, 0, 3], [3, 3, 3]];
        case 'J': return [[4, 0, 0], [4, 4, 4]];
        case 'I': return [[0, 0, 0, 0], [5, 5, 5, 5]];
        case 'S': return [[0, 6, 6], [6, 6, 0]];
        case 'Z': return [[7, 7, 0], [0, 7, 7]];
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        playerReset();
    }
    player.lastMove = 'drop';
    draw();
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
    player.lastMove = 'move';
}

function rotate(matrix, dir) {
    const result = matrix[0].map((_, i) => matrix.map(row => row[i]));
    if (dir > 0) result.forEach(row => row.reverse());
    else result.reverse();
    return result;
}

function getKickTable(type, from, to) {
    const key = `${from}->${to}`;
    const JLSTZ = {
        '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
    };
    const I = {
        '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
        '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
    };
    if (type === 'I') return I[key] || [[0, 0]];
    if (type === 'O') return [[0, 0]];
    return JLSTZ[key] || [[0, 0]];
}

function playerRotate(dir) {
    const oldRot = player.rotation;
    const newRot = (oldRot + dir + 4) % 4;
    const kicks = getKickTable(player.type, oldRot, newRot);
    const original = player.matrix;
    const rotated = rotate(player.matrix, dir);

    for (const [dx, dy] of kicks) {
        player.matrix = rotated;
        player.pos.x += dx;
        player.pos.y += dy;
        if (!collide(arena, player)) {
            player.rotation = newRot;
            player.lastMove = 'rotate';
            checkTSpin();
            return;
        }
        player.pos.x -= dx;
        player.pos.y -= dy;
    }
    player.matrix = original;
}

function checkTSpin() {
    if (player.type !== 'T' || player.lastMove !== 'rotate') {
        lastMoveWasRotate = false;
        return;
    }
    const { x, y } = player.pos;
    const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
    let count = 0;
    for (const [cx, cy] of corners) {
        if (cy < 0 || cy >= arena.length || cx < 0 || cx >= arena[0].length || arena[cy][cx] !== 0) {
            count++;
        }
    }
    lastMoveWasRotate = count >= 3;
    if (lastMoveWasRotate) console.log("✅ Tスピン成功");
}

function arenaSweep() {
    let lines = 0;
    outer: for (let y = arena.length - 1; y >= 0; y--) {
        for (let x = 0; x < arena[y].length; x++) {
            if (arena[y][x] === 0) continue outer;
        }
        arena.splice(y, 1);
        arena.unshift(new Array(10).fill(0));
        lines++;
        y++;
    }

    if (lastMoveWasRotate && lines > 0) {
        if (lines === 1) player.score += 200;
        else if (lines === 2) {
            player.score += 700;
            console.log("Tスピンダブル（TD砲）成功！");
        }
        else if (lines === 3) player.score += 1200;
    } else {
        player.score += [0, 100, 300, 500, 800][lines] || 0;
    }
    scoreEl.textContent = player.score;
    if (player.score > highscore) {
        highscore = player.score;
        highEl.textContent = highscore;
        localStorage.setItem('tetrisHigh', highscore);
    }
}

function playerReset() {
    const type = pieces[Math.floor(Math.random() * pieces.length)];
    player.matrix = createPiece(type);
    player.type = type;
    player.rotation = 0;
    player.pos.y = 0;
    player.pos.x = Math.floor((arena[0].length - player.matrix[0].length) / 2);

    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        alert("ゲームオーバー");
        player.score = 0;
        scoreEl.textContent = 0;
    }
}

function update(time = 0) {
    draw();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft') playerMove(-1);
    else if (e.code === 'ArrowRight') playerMove(1);
    else if (e.code === 'ArrowDown') playerDrop();
    else if (e.code === 'ArrowUp') playerRotate(1);
    else if (e.code === 'KeyZ') playerRotate(-1);
});
