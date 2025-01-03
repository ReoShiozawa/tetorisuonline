const socket = io();
let currentRoom = null;
let isInGame = false;

// DOM要素の取得
const roomList = document.getElementById('room-list');
const createRoomForm = document.getElementById('create-room-form');
const roomNameInput = document.getElementById('room-name');
const matchStatus = document.getElementById('match-status');
const findMatchBtn = document.getElementById('find-match');
const opponentCanvas = document.getElementById('opponent');
const opponentContext = opponentCanvas.getContext('2d');

// ルームリストの更新を要求
function updateRoomList() {
    socket.emit('getRooms');
}

// ページロード時にルームリストを取得
window.addEventListener('load', updateRoomList);

// ルーム作成フォームの処理
createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        socket.emit('createRoom', roomName);
        roomNameInput.value = '';
    }
});

// ルームリストの受信と表示を修正
socket.on('roomList', (rooms) => {
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        const isCreator = socket.id === room.players[0];
        
        div.innerHTML = `
            <span>${room.name} (${room.players}/2)</span>
            <div class="room-buttons">
                ${isCreator ? 
                    `<button onclick="deleteRoom('${room.roomId}')" class="delete-btn">削除</button>` : 
                    ''
                }
                <button onclick="joinRoom('${room.roomId}')" ${room.players >= 2 ? 'disabled' : ''}>
                    参加
                </button>
            </div>
        `;
        roomList.appendChild(div);
    });
});

// ルーム作成完了の処理
socket.on('roomCreated', (data) => {
    matchStatus.textContent = 'ルームを作成しました。対戦相手を待っています...';
    currentRoom = data.roomId;
});

// ルームの更新通知
socket.on('roomUpdated', updateRoomList);

// ルームに参加
function joinRoom(roomId) {
    socket.emit('joinRoom', roomId);
    matchStatus.textContent = 'ルームに参加しています...';
}

findMatchBtn.addEventListener('click', () => {
    if (!isInGame) {
        socket.emit('findMatch');
        matchStatus.textContent = '対戦相手を探しています...';
        findMatchBtn.disabled = true;
    }
});

socket.on('waiting', () => {
    matchStatus.textContent = '対戦相手を待っています...';
});

socket.on('matchStart', (data) => {
    currentRoom = data.roomId;
    isInGame = true;
    matchStatus.textContent = '対戦開始！';
    findMatchBtn.textContent = '対戦中';
    initGame(); // ゲームをリセット
});

socket.on('opponentUpdate', (data) => {
    // 相手のボードを描画
    drawOpponentBoard(data.board);
    document.getElementById('opponent-score').textContent = data.score;
});

// ゲーム終了時の処理を修正
socket.on('gameEnd', (data) => {
    isInGame = false;
    findMatchBtn.disabled = false;
    findMatchBtn.textContent = '新しい対戦を始める';
    
    if (data.winner === socket.id) {
        matchStatus.textContent = '勝利！';
    } else {
        matchStatus.textContent = '敗北...';
        initGame(); // 敗者側でリセット
    }
});

// 勝者用のリセット処理を追加
socket.on('resetGame', () => {
    initGame();
});

// 攻撃を受けた時の処理を追加
socket.on('receiveAttack', (data) => {
    addGarbageLines(data.lines);
});

socket.on('opponentDisconnected', () => {
    isInGame = false;
    findMatchBtn.disabled = false;
    findMatchBtn.textContent = '新しい対戦を始める';
    matchStatus.textContent = '相手が切断しました';
    currentRoom = null;
    updateRoomList();
});

// ルーム削除関数を修正
function deleteRoom(roomId) {
    if (!confirm('このルームを削除してもよろしいですか？')) return;
    socket.emit('deleteRoom', roomId);
}

// ルーム削除通知の受信
socket.on('roomDeleted', (data) => {
    if (currentRoom === data.roomId) {
        currentRoom = null;
        isInGame = false;
        matchStatus.textContent = data.message;
        updateRoomList();
    }
});

function drawOpponentBoard(board) {
    const blockSize = 10;
    opponentContext.fillStyle = '#000';
    opponentContext.fillRect(0, 0, opponentCanvas.width, opponentCanvas.height);

    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                opponentContext.fillStyle = value;
                opponentContext.fillRect(
                    x * blockSize,
                    y * blockSize,
                    blockSize - 1,
                    blockSize - 1
                );
            }
        });
    });
}
