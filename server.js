const express = require('express');
const WebSocket = require('ws');
const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';  // すべてのネットワークインターフェースでリッスン

// CORS設定を追加
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// 静的ファイルの提供
app.use(express.static(__dirname));

// HTTPサーバーの作成（express使用）
const server = app.listen(PORT, HOST, () => {
    const addresses = Object.values(require('os').networkInterfaces())
        .flat()
        .filter(item => !item.internal && item.family === 'IPv4')
        .map(item => item.address);

    console.log('\x1b[32m%s\x1b[0m', '=== テトリスオンラインサーバー ===');
    console.log('サーバーが起動しました！');
    console.log('アクセス可能なアドレス:');
    addresses.forEach(addr => {
        console.log(`http://${addr}:${PORT}`);
    });
    console.log('----------------------------------------');
    console.log('接続待機中...\n');
});

// WebSocketサーバーの設定を修正
const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,
    clientTracking: true
});

// ルーム管理を改善
const MAX_ROOMS = 10;
const rooms = new Map();

// 初期ルームの作成
for (let i = 1; i <= MAX_ROOMS; i++) {
    rooms.set(`room${i}`, {
        id: `room${i}`,
        players: [],
        maxPlayers: 2,
        status: 'waiting',
        created: new Date()
    });
}

let waitingPlayer = null;
let connectionCount = 0;

wss.on('connection', (ws) => {
    connectionCount++;
    ws.id = generateId();
    console.log(`Client ${ws.id} connected`);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleMessage(ws, data);
    });

    ws.on('close', () => {
        connectionCount--;
        console.log(`Player ${ws.id} が切断しました (現在の接続数: ${connectionCount})`);
        handlePlayerDisconnect(ws);
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'getRooms':
            sendRoomList(ws);
            break;
        case 'joinRoom':
            joinRoom(ws, data.roomId);
            break;
        case 'gameState':
            handleGameState(ws, data);
            break;
        case 'garbage':
            handleGarbage(ws, data);
            break;
        case 'gameOver':
            handleGameOver(ws, data);
            break;
    }
}

function sendRoomList(ws) {
    const roomList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        playerCount: room.players.length,
        isFull: room.players.length >= room.maxPlayers,
        status: room.status
    }));

    ws.send(JSON.stringify({
        type: 'roomList',
        rooms: roomList
    }));
}

function joinRoom(ws, roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        ws.send(JSON.stringify({ 
            type: 'joinError', 
            message: 'ルームが存在しません' 
        }));
        return;
    }

    if (room.players.length >= room.maxPlayers) {
        ws.send(JSON.stringify({ 
            type: 'joinError', 
            message: 'ルームが満員です' 
        }));
        return;
    }

    if (room.status === 'playing') {
        ws.send(JSON.stringify({ 
            type: 'joinError', 
            message: 'ゲームが既に開始されています' 
        }));
        return;
    }

    // 既存のルームから削除（他のルームに入っていた場合）
    handlePlayerDisconnect(ws);

    // 新しいルームに参加
    room.players.push(ws);
    ws.roomId = roomId;

    // 参加成功を通知
    ws.send(JSON.stringify({
        type: 'joinSuccess',
        roomId: roomId,
        playerNumber: room.players.length
    }));

    // プレイヤーが2人揃ったらゲーム開始
    if (room.players.length === room.maxPlayers) {
        room.status = 'playing';
        startGame(room);
    } else {
        // 待機中のプレイヤーに通知
        ws.send(JSON.stringify({
            type: 'waiting',
            message: '対戦相手の参加を待っています...'
        }));
    }
}

function startGame(room) {
    room.players.forEach((player, index) => {
        player.send(JSON.stringify({
            type: 'gameStart',
            playerNumber: index + 1
        }));
    });
}

function handleGameState(ws, data) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const opponent = room.players.find(p => p !== ws);
    if (opponent && opponent.readyState === WebSocket.OPEN) {
        opponent.send(JSON.stringify({
            type: 'opponentState',
            board: data.board,
            score: data.score
        }));
    }
}

function handleGarbage(ws, data) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const opponent = room.players.find(p => p !== ws);
    if (opponent) {
        opponent.send(JSON.stringify({
            type: 'garbage',
            ...data
        }));
    }
}

function handleGameOver(ws, data) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const opponent = room.players.find(p => p !== ws);
    if (opponent) {
        opponent.send(JSON.stringify({
            type: 'gameOver',
            winner: 'you',
            score: data.score
        }));
    }

    room.status = 'finished';
    setTimeout(() => {
        if (rooms.has(room.id)) {
            rooms.get(room.id).status = 'waiting';
            rooms.get(room.id).players = [];
        }
    }, 5000);
}

function handlePlayerDisconnect(ws) {
    const room = rooms.get(ws.roomId);
    if (room) {
        room.players = room.players.filter(p => p !== ws);
        room.status = 'waiting';

        const opponent = room.players[0];
        if (opponent) {
            opponent.send(JSON.stringify({ 
                type: 'opponentDisconnected' 
            }));
        }
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
