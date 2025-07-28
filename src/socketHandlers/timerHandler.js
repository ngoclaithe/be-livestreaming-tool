const logger = require('../utils/logger');

function parseTimeToMs(timeStr) {
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return (minutes * 60 + seconds) * 1000;
}

function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(total / 60).toString().padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}

function handleTimer(io, socket, rooms, userSessions) {
        // Timer start
    socket.on('timer_start', (data) => {
        console.log('[timer_start] Received from FE:', data);
        const { accessCode, startTime = '00:00' } = data;
        const room = validateRequest(accessCode, 'start');
        if (!room) return;

        if (room.currentState?.matchData?.status !== 'live') {
            room.currentState = room.currentState || {};
            room.currentState.matchData = room.currentState.matchData || {};
            room.currentState.matchData.status = 'live';
            
            room.currentState.matchData.matchTime = room.currentState.matchData.matchTime || '00:00';
            room.currentState.matchData.period = room.currentState.matchData.period || 1;
            
            console.log(`[timer_start] Updated matchData.status to 'live' for room ${accessCode}`);
            
            io.to(`room_${accessCode}`).emit('match_time_updated', {
                time: {
                    status: 'live',
                    matchTime: room.currentState.matchData.matchTime,
                    period: room.currentState.matchData.period
                },
                timestamp: Date.now()
            });
        }

        const initialTimeMs = parseTimeToMs(startTime);
        room.timer = {
            isRunning: true,
            startTime: Date.now(),
            initialTime: initialTimeMs,
            pausedTime: 0,
            lastUpdate: Date.now(),
            displayTime: startTime,
            hasUpdatedMatchStatus: true
        };

        broadcast(io, room, 'timer_started', { 
            initialTime: startTime,
            timestamp: Date.now()
        });
    });

    // Timer pause
    socket.on('timer_pause', (data) => {
        console.log('[timer_pause] Received from FE:', data);
        const { accessCode } = data;
        const room = validateRequest(accessCode, 'pause');
        if (!room || !room.timer?.isRunning) return;

        room.timer.isRunning = false;
        room.timer.pausedTime = Date.now() - room.timer.startTime;
        broadcast(io, room, 'timer_paused', { 
            elapsedTime: room.timer.pausedTime,
            displayTime: room.timer.displayTime 
        });
    });

    // Timer resume
    socket.on('timer_resume', (data) => {
        console.log('[timer_resume] Received from FE:', data);
        const { accessCode } = data;
        const room = validateRequest(accessCode, 'resume');
        if (!room || !room.timer || room.timer.isRunning) return;

        room.timer.isRunning = true;
        room.timer.startTime = Date.now() - room.timer.pausedTime;
        broadcast(io, room, 'timer_resumed', { 
            displayTime: room.timer.displayTime 
        });
    });

    // Timer reset
    socket.on('timer_reset', (data) => {
        console.log('[timer_reset] Received from FE:', data);
        const { accessCode, initialTime = '00:00' } = data;
        const room = validateRequest(accessCode, 'reset');
        if (!room) return;

        room.timer = {
            isRunning: false,
            startTime: 0,
            initialTime: parseTimeToMs(initialTime),
            pausedTime: 0,
            displayTime: initialTime
        };
        broadcast(io, room, 'timer_reset', { initialTime });
    });

    // Sync request
    socket.on('timer_sync_request', ({ accessCode }) => {
        console.log('[timer_sync_request] Received from FE:', { accessCode });
        const room = rooms.get(accessCode);
        if (!room?.timer) {
            return socket.emit('timer_sync_response', {
                isRunning: false,
                displayTime: '00:00',
                timestamp: Date.now()
            });
        }

        socket.emit('timer_sync_response', {
            isRunning: room.timer.isRunning,
            displayTime: room.timer.displayTime,
            timestamp: Date.now()
        });
    });

    // Helper functions
    function validateRequest(accessCode, action) {
        if (!accessCode) return null;
        const room = rooms.get(accessCode);
        if (!room) return null;
        const userData = userSessions.get(socket.id);
        if (!userData || !room.adminClients?.has(socket.id)) return null;
        return room;
    }

    function broadcast(io, room, event, data) {
        console.log(`[timerHandler] Broadcast event "${event}" to room ${room.accessCode}:`, data);
        io.to(`room_${room.accessCode}`).emit(event, {
            ...data,
            timestamp: Date.now()
        });
    }
}

// Timer tick processing 
function processTimerTick(io, rooms) {
    rooms.forEach((room, accessCode) => {
        if (!room.timer?.isRunning) return;
        
        const now = Date.now();
        const elapsed = now - room.timer.startTime;
        const totalTime = room.timer.initialTime + elapsed;
        const displayTime = formatTime(totalTime);
        
        if (room.timer.displayTime !== displayTime) {
            room.timer.displayTime = displayTime;
            room.timer.lastUpdate = now;
            
            console.log(`[timerHandler] Broadcast event "timer_tick" to room ${accessCode}:`, {
                displayTime: displayTime,
                timestamp: now
            });

            // Chỉ gửi thời gian, không gửi trạng thái
            io.to(`room_${accessCode}`).emit('timer_tick', {
                displayTime: displayTime,
                timestamp: now
            });
        }
    });
}

function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const min = Math.floor(total / 60).toString().padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}

module.exports = { handleTimer, processTimerTick };
