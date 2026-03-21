#!/bin/bash

# Quick start script for TradeTrackAI with Docker + PostgreSQL

set -e

echo "🚀 TradeTrackAI Setup with Docker"
echo "=================================="
echo ""

# Check if Docker is installed
echo "📦 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install it from https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Install Docker Desktop which includes Compose"
    exit 1
fi

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo "❌ Docker daemon not running. Start Docker Desktop and try again"
    exit 1
fi

echo "✅ Docker found and running"
echo ""

# Start Docker services (PostgreSQL + Backend)
echo "🐳 Starting Docker containers (PostgreSQL + Backend)..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        docker-compose logs postgres
        exit 1
    fi
    echo "  Waiting... ($i/30)"
    sleep 1
done

echo ""

# Run Prisma migrations inside the backend container
echo "🗄️  Running database migrations..."
docker-compose exec -T backend npm run prisma:migrate -- --skip-generate || true

echo "✅ Backend setup complete!"
echo ""

# Setup frontend
cd tradetrack-ai
echo "⚙️  Setting up frontend..."
npm install --legacy-peer-deps

if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "📝 Created tradetrack-ai/.env.local - please update with your settings"
fi

echo ""
echo "✅ Frontend setup complete!"
echo ""

# Show running containers
echo "📋 Running Containers:"
echo "====================="
docker-compose ps
echo ""

echo "📋 Next Steps:"
echo "============="
echo ""
echo "1. Update frontend configuration:"
echo "   - tradetrack-ai/.env.local (Auth0 and API settings)"
echo ""
echo "2. Start the frontend in a new terminal:"
echo "   cd tradetrack-ai && npm run dev"
echo ""
echo "3. Open http://localhost:5173 in your browser"
echo ""
echo "4. Backend is already running at http://localhost:5000"
echo "   PostgreSQL is running in Docker on :5432"
echo ""
echo "5. Test both modes:"
echo "   - Demo: Click 'Enter as Guest'"
echo "   - Authenticated: Click 'Login' (requires Auth0 setup)"
echo ""
echo "6. To stop everything:"
echo "   docker-compose down"
echo ""
echo "7. To view logs:"
echo "   docker-compose logs backend     (backend logs)"
echo "   docker-compose logs postgres    (database logs)"
echo ""

