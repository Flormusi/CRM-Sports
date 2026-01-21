#!/bin/bash

# Build the application
docker-compose build

# Run database migrations
docker-compose run app npx prisma migrate deploy

# Start the services
docker-compose up -d

# Show logs
docker-compose logs -f app