# Livestream Tool Backend

Backend service for Livestream Tool application built with Node.js, Express, and PostgreSQL.

## Features

- User authentication with JWT
- Role-based authorization (user, admin, broadcaster)
- Streaming management
- File upload with Cloudinary
- Rate limiting and request validation
- API documentation with Swagger
- Real-time features with Socket.IO
- Caching with Redis

## Prerequisites

- Node.js 14.x or higher
- PostgreSQL 12.x or higher
- Redis 6.x or higher
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/livestream-tool-backend.git
   cd livestream-tool-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your configuration

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

The server will be running at `http://localhost:5000` by default.

## API Documentation

After starting the server, you can access the API documentation at:
- Swagger UI: `http://localhost:5000/api-docs`
- API Spec: `http://localhost:5000/api-docs.json`

## Database Setup

1. Create a new PostgreSQL database:
   ```sql
   CREATE DATABASE livestream_tool;
   ```

2. The application will automatically create and update database tables using Sequelize migrations.

## Environment Variables

See `.env.example` for all available environment variables.

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot-reload
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## License

MIT
