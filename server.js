const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static('.'));

// ルーム管理を強化
const rooms = new Map();
const playerRooms = new Map(); // プレイヤーがどのルームにいるかを追跡

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // 利用可能なルームのリストを要求
    socket.on('getRooms', () => {
        const availableRooms = Array.from(rooms.entries())
            .filter(([_, room]) => room.players.length < 2)
            .map(([roomId, room]) => ({
                roomId,
                name: room.name,
                players: room.players.length
            }));
        socket.emit('roomList', availableRooms);
    });

    // 新しいルームを作成
    socket.on('createRoom', (roomName) => {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        rooms.set(roomId, {
            name: roomName,
            players: [socket.id],
            gameState: {
                scores: {},
                gameOver: false
            }
        });
        playerRooms.set(socket.id, roomId);
        socket.join(roomId);
        
        // ルーム作成者に確認を送信
        socket.emit('roomCreated', { roomId, name: roomName });
        // 全クライアントにルームリストを更新
        io.emit('roomUpdated');
    });

    // 既存のルームに参加
    socket.on('joinRoom', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players.length < 2) {
            room.players.push(socket.id);
            playerRooms.set(socket.id, roomId);
            socket.join(roomId);

            // ゲーム開始を通知
            io.to(roomId).emit('matchStart', {
                roomId,
                players: {
                    player1: room.players[0],
                    player2: room.players[1]
                }
            });

            // 全クライアントにルームリストを更新
            io.emit('roomUpdated');
        }
    });

    // ルーム削除の処理を追加
    socket.on('deleteRoom', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players[0] === socket.id) { // ルーム作成者のみ削除可能
            // ルーム内の全プレイヤーに通知
            io.to(roomId).emit('roomDeleted', {
                roomId,
                message: 'ルームが削除されました'
            });
            
            // ルーム内のプレイヤーの参照を削除
            room.players.forEach(playerId => {
                playerRooms.delete(playerId);
            });
            
            // ルームを削除
            rooms.delete(roomId);
            io.emit('roomUpdated');
        }
    });

    // ゲーム更新の処理
    socket.on('gameUpdate', (data) => {
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            socket.to(roomId).emit('opponentUpdate', data);
        }
    });

    // ゲームオーバーの処理
    socket.on('gameover', () => {
        const roomId = playerRooms.get(socket.id);
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            const opponent = room.players.find(id => id !== socket.id);
            io.to(roomId).emit('gameEnd', {
                winner: opponent,
                loser: socket.id
            });
        }
    });

    // ゲーム終了の処理
    socket.on('gameEnd', (data) => {
        const roomId = playerRooms.get(socket.id);
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            const opponent = room.players.find(id => id !== socket.id);
            io.to(roomId).emit('gameEnd', {
                winner: opponent,
                loser: socket.id
            });
            
            // 勝者にもリセット信号を送信
            io.to(opponent).emit('resetGame');
        }
    });

    // 攻撃処理を追加
    socket.on('attack', (data) => {
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            socket.to(roomId).emit('receiveAttack', data);
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                // ルームからプレイヤーを削除
                room.players = room.players.filter(id => id !== socket.id);
                
                if (room.players.length === 0) {
                    // ルームが空になった場合は削除
                    rooms.delete(roomId);
                } else {
                    // 残りのプレイヤーに通知
                    socket.to(roomId).emit('opponentDisconnected');
                }
            }
            playerRooms.delete(socket.id);
            io.emit('roomUpdated');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
