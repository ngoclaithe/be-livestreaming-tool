const logger = require('../utils/logger');


function handleConnection(io, socket, rooms, userSessions) {
  logger.info(`New client connected: ${socket.id}`);
  
  userSessions.set(socket.id, {
    socketId: socket.id,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    accessCode: null,
    clientType: null // 'admin', 'display', or 'client'
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    const userData = userSessions.get(socket.id);
    if (userData && userData.accessCode) {
      const room = rooms.get(userData.accessCode);
      if (room) {
        // Remove from room clients
        room.clients.delete(socket.id);
        
        // Remove from specific client type sets
        room.adminClients.delete(socket.id);
        room.displayClients.delete(socket.id);
        
        // Notify other clients about disconnection
        socket.to(`room_${userData.accessCode}`).emit('client_disconnected', {
          clientId: socket.id,
          clientCount: room.clients.size
        });
        
        // Clean up empty rooms
        if (room.clients.size === 0) {
          rooms.delete(userData.accessCode);
          logger.info(`Room ${userData.accessCode} cleaned up`);
        }
      }
    }
    
    // Remove user session
    userSessions.delete(socket.id);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error(`Socket error (${socket.id}):`, error);
  });
}

module.exports = { handleConnection };
