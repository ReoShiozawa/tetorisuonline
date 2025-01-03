const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const BLOCK_SIZE = 20;
const COLS = 12;
const ROWS = 20;

// テトリミノの形状定義
const TETROMINOS = {
    'I': [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    'J': [[1,0,0], [1,1,1], [0,0,0]],
    'L': [[0,0,1], [1,1,1], [0,0,0]],
    'O': [[1,1], [1,1]],
    'S': [[0,1,1], [1,1,0], [0,0,0]],
    'T': [[0,1,0], [1,1,1], [0,0,0]],
    'Z': [[1,1,0], [0,1,1], [0,0,0]]
};

const COLORS = {
    'I': 'cyan',
    'J': 'blue',
    'L': 'orange',
    'O': 'yellow',
    'S': 'green',
    'T': 'purple',
    'Z': 'red'
};

const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdContext = holdCanvas.getContext('2d');

// グローバル変数の初期化を修正
let bag = [];
let board = null;
let piece = null;
let nextPieces = [];
let holdPiece = null;
let canHold = true;
let dropCounter = 0;
let lastTime = 0;
let score = 0;

function createBoard() {
    return Array(ROWS).fill().map(() => Array(COLS).fill(0));
}

function generateBag() {
    const pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    return pieces.sort(() => Math.random() - 0.5);
}

// getRandomPiece関数を修正
function getRandomPiece() {
    if (bag.length === 0) {
        bag = generateBag();
    }
    const tetromino = bag.pop();
    return {
        pos: {x: Math.floor(COLS/2) - 1, y: 0},
        matrix: TETROMINOS[tetromino],
        color: COLORS[tetromino],
        type: tetromino,
        rotation: 0  // 回転状態を追加
    };
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawGhost(); // ゴーストピースを描画（通常のピースの前に描画）
    drawPiece();
    drawNext();
    drawHold();
}

function drawBoard() {
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                context.fillStyle = value;
                context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        });
    });
}

function drawPiece() {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                context.fillStyle = piece.color;
                context.fillRect(
                    (piece.pos.x + x) * BLOCK_SIZE,
                    (piece.pos.y + y) * BLOCK_SIZE,
                    BLOCK_SIZE - 1,
                    BLOCK_SIZE - 1
                );
            }
        });
    });
}

function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    nextPieces.forEach((piece, index) => {
        drawPieceAt(nextContext, piece.matrix, piece.color, 
            {x: 1, y: index * 4 + 1}, 15);
    });
}

function drawHold() {
    holdContext.fillStyle = '#000';
    holdContext.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    
    if (holdPiece) {
        drawPieceAt(holdContext, holdPiece.matrix, holdPiece.color, 
            {x: 1, y: 1}, 15);
    }
}

function drawPieceAt(ctx, matrix, color, pos, size) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                ctx.fillStyle = color;
                ctx.fillRect(
                    (pos.x + x) * size,
                    (pos.y + y) * size,
                    size - 1,
                    size - 1
                );
            }
        });
    });
}

function merge() {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                board[piece.pos.y + y][piece.pos.x + x] = piece.color;
            }
        });
    });
}

// collision関数を修正して、引数を受け取れるようにする
function collision(p = piece) {
    const matrix = p.matrix;
    const pos = p.pos;
    
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] && (
                board[y + pos.y] === undefined ||
                board[y + pos.y][x + pos.x] === undefined ||
                board[y + pos.y][x + pos.x])) {
                return true;
            }
        }
    }
    return false;
}

function moveDown() {
    piece.pos.y++;
    if (collision()) {
        piece.pos.y--;
        merge();
        if (isGameOver()) {
            alert('Game Over! Score: ' + score);
            board = createBoard();
            score = 0;
            document.getElementById('score').textContent = score;
            nextPieces = [getRandomPiece(), getRandomPiece(), getRandomPiece()];
            holdPiece = null;
            piece = getNextPiece();
            return;
        }
        clearLines();
        piece = getNextPiece();
        canHold = true;
    }
}

function moveHorizontally(dir) {
    piece.pos.x += dir;
    if (collision()) {
        piece.pos.x -= dir;
    }
}

// I型ミノの回転オフセットを定義
const I_WALLKICK_DATA = {
    '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};

const NORMAL_WALLKICK_DATA = {
    '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};

function rotate() {
    const matrix = piece.matrix;
    const newMatrix = matrix[0].map((_, i) => 
        matrix.map(row => row[i]).reverse()
    );
    
    const originalState = {
        matrix: [...piece.matrix],
        pos: {...piece.pos},
        rotation: piece.rotation || 0
    };
    
    const newRotation = ((originalState.rotation || 0) + 1) % 4;
    const kickData = piece.type === 'I' ? I_WALLKICK_DATA : NORMAL_WALLKICK_DATA;
    const tests = kickData[`${originalState.rotation || 0}->${newRotation}`];
    
    piece.matrix = newMatrix;
    piece.rotation = newRotation;
    
    for (let [offsetX, offsetY] of tests) {
        piece.pos.x = originalState.pos.x + offsetX;
        piece.pos.y = originalState.pos.y - offsetY;
        
        if (!collision()) {
            return; // 回転成功
        }
    }
    
    // 回転失敗時は元に戻す
    piece.matrix = originalState.matrix;
    piece.pos = originalState.pos;
    piece.rotation = originalState.rotation;
}

function clearLines() {
    let linesToRemove = [];
    
    // 消去する行を特定
    for (let y = 0; y < ROWS; y++) {
        if (board[y].every(cell => cell !== 0)) {
            linesToRemove.push(y);
        }
    }
    
    if (linesToRemove.length === 0) return;
    
    // まとめて消去処理
    for (let y of linesToRemove) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
    }
    
    // スコア加算（消した行数に応じて）
    const points = [0, 100, 300, 500, 800]; // 1行、2行、3行、4行のスコア
    score += points[linesToRemove.length] || 0;
    document.getElementById('score').textContent = score;
}

function getNextPiece() {
    const next = nextPieces.shift();
    nextPieces.push(getRandomPiece());
    return next;
}

function hold() {
    if (!canHold) return;
    
    if (holdPiece === null) {
        holdPiece = {
            matrix: piece.matrix,
            color: piece.color,
            type: piece.type  // type情報を追加
        };
        piece = getNextPiece();
    } else {
        const temp = {
            matrix: piece.matrix,
            color: piece.color,
            type: piece.type  // type情報を追加
        };
        piece = {
            pos: {x: 5, y: 0},
            matrix: holdPiece.matrix,
            color: holdPiece.color,
            type: holdPiece.type  // type情報を追加
        };
        holdPiece = temp;
    }
    
    canHold = false;
}

// ゲームオーバー処理を修正
function isGameOver() {
    if (board[0].some(cell => cell !== 0) || board[1].some(cell => cell !== 0)) {
        if (isInGame) {
            socket.emit('gameover');
        }
        return true;
    }
    return false;
}

// 初期化処理を修正
function initGame() {
    // ゲームの状態を初期化
    board = createBoard();
    bag = generateBag();
    
    // 次のピースを初期化
    nextPieces = [];
    for (let i = 0; i < 3; i++) {
        nextPieces.push(getRandomPiece());
    }
    
    // 現在のピースを初期化（rotation情報を追加）
    piece = getRandomPiece();
    piece.rotation = 0;  // 明示的に回転情報を初期化
    
    // その他の状態をリセット
    score = 0;
    holdPiece = null;
    canHold = true;
    dropCounter = 0;
    lastTime = 0;
    
    // UIの更新
    document.getElementById('score').textContent = '0';
}

// モバイルコントロール用の関数を修正
function initMobileControls() {
    const controls = {
        'btn-left': () => moveHorizontally(-1),
        'btn-right': () => moveHorizontally(1),
        'btn-down': () => moveDown(),
        'btn-rotate': () => rotate(),
        'btn-hold': () => hold(),
        'btn-harddrop': () => hardDrop(),
    };

    Object.entries(controls).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('mousedown', handler);
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handler();
            });
        }
    });
}

// ハードドロップ機能を追加
function hardDrop() {
    while (!collision()) {
        piece.pos.y++;
    }
    piece.pos.y--;
    moveDown();
}

// イベントリスナーとゲーム開始処理を修正
window.addEventListener('load', () => {
    initGame();
    initMobileControls();
    
    // キーボードイベントの設定
    document.addEventListener('keydown', event => {
        switch (event.key) {
            case 'ArrowLeft':
                moveHorizontally(-1);
                break;
            case 'ArrowRight':
                moveHorizontally(1);
                break;
            case 'ArrowDown':
                moveDown();
                break;
            case 'ArrowUp':
                rotate();
                break;
            case 'c':
            case 'C':
                hold();
                break;
            case ' ': // スペースキー
                hardDrop();
                break;
        }
    });

    // ゲームループを開始
    lastTime = performance.now();
    requestAnimationFrame(update);
});

// メインのupdateループを修正
function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    
    if (dropCounter > 1000) {
        moveDown();
        dropCounter = 0;
    }
    
    draw();
    
    // 対戦相手に盤面情報を送信
    if (isInGame && currentRoom) {
        socket.emit('gameUpdate', {
            board: board,
            score: score
        });
    }
    
    requestAnimationFrame(update);
}

// 予測位置を計算する関数の追加
function getGhostPosition() {
    const ghost = {
        pos: { ...piece.pos },
        matrix: piece.matrix,
        color: piece.color
    };
    
    while (!collision(ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;
    
    return ghost;
}

// 予測位置を描画する関数の追加
function drawGhost() {
    if (!piece) return;  // pieceがnullの場合は処理をスキップ
    
    const ghost = getGhostPosition();
    ghost.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                // 元の色を取得してRGBA形式に変換
                const color = ghost.color;
                context.fillStyle = color.startsWith('rgb') ? 
                    color.replace(')', ', 0.3)').replace('rgb', 'rgba') : 
                    `rgba(${colorToRGB(color).join(',')}, 0.3)`;
                
                context.fillRect(
                    (ghost.pos.x + x) * BLOCK_SIZE,
                    (ghost.pos.y + y) * BLOCK_SIZE,
                    BLOCK_SIZE - 1,
                    BLOCK_SIZE - 1
                );
            }
        });
    });
}

// 色文字列をRGB配列に変換するヘルパー関数
function colorToRGB(color) {
    const colors = {
        'cyan': [0, 255, 255],
        'blue': [0, 0, 255],
        'orange': [255, 165, 0],
        'yellow': [255, 255, 0],
        'green': [0, 255, 0],
        'purple': [128, 0, 128],
        'red': [255, 0, 0]
    };
    return colors[color] || [128, 128, 128]; // デフォルトはグレー
}
