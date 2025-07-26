const logger = require('../utils/logger');

class WebSocketService {
  constructor(io) {
    this.io = io;
    this.connections = new Map();
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info(`New WebSocket connection: ${socket.id}`);
      
      // Store the socket connection
      this.connections.set(socket.id, socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.connections.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error: ${error.message}`, { error });
      });

      // Add your custom event handlers here
      this.setupEventHandlers(socket);
    });

    return this.io;
  }

  setupEventHandlers(socket) {
    // Example event handler
    socket.on('message', (data) => {
      try {
        logger.info(`Message from ${socket.id}:`, data);
        // Broadcast to all clients
        this.io.emit('message', { from: socket.id, ...data });
      } catch (error) {
        logger.error('Error handling message:', error);
        socket.emit('error', { message: 'Error processing message' });
      }
    });

    // Add more event handlers as needed
  }

  // Broadcast to all connected clients
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Send to a specific client
  sendToClient(socketId, event, data) {
    const socket = this.connections.get(socketId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }
}

module.exports = WebSocketService;
