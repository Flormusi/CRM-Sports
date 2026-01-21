# CRM Sports Backend

Backend API for the CRM Sports application built with Node.js, Express, TypeScript, and Prisma.

## Features

- **Authentication**: JWT-based authentication system
- **Client Management**: Complete CRUD operations for client management
- **Task Management**: Task creation, assignment, and tracking with priorities and status
- **API Documentation**: Swagger/OpenAPI documentation available at `/api-docs`
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest test suite with database integration tests
- **TypeScript**: Full TypeScript support with strict type checking

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit the `.env` file with your database and JWT configuration:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/crm_sports"
JWT_SECRET="your-jwt-secret-key" # obligatorio, sin fallback
JWT_EXPIRES_IN="24h"
PORT=3002
```

4. Set up the database:

```bash
# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3002`

### Production Mode

```bash
npm run build
npm start
```

## API Documentation

Once the server is running, you can access the Swagger documentation at:

```
http://localhost:3002/api-docs
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client by ID
- `POST /api/clients` - Create new client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Database Schema

### Models

- **User**: Authentication and user management
- **Client**: Client information and contact details
- **Task**: Task management with priorities, status, and client association

### Enums

- **Role**: `USER`, `ADMIN`
- **Priority**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- **Status**: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npx prisma studio` - Open Prisma Studio for database management
- `npx prisma migrate dev` - Run database migrations
- `npx prisma generate` - Generate Prisma client

## Project Structure

```
src/
├── __tests__/          # Test files
├── config/             # Configuration files (Swagger, etc.)
├── controllers/        # Route controllers
├── lib/               # Database connection and utilities
├── middleware/        # Express middleware
├── routes/            # API routes
├── tests/             # Additional test files
├── types/             # TypeScript type definitions
├── app.ts             # Express app configuration
├── index.ts           # Application entry point
└── server.ts          # Server setup
```

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Swagger** - API documentation
- **Jest** - Testing framework
- **bcrypt** - Password hashing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests to ensure everything works
5. Submit a pull request

## License

This project is licensed under the MIT License.
