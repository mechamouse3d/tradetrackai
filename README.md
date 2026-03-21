run setup.sh

📋 Next Steps:
=============

1. Update frontend configuration:
   - tradetrack-ai/.env.local (Auth0 and API settings)

2. Start the frontend in a new terminal:
   cd tradetrack-ai && npm run dev

3. Open http://localhost:5173 in your browser

4. Backend is already running at http://localhost:5000
   PostgreSQL is running in Docker on :5432

5. Test both modes:
   - Demo: Click 'Enter as Guest'
   - Authenticated: Click 'Login' (requires Auth0 setup)

6. To stop everything:
   docker-compose down

7. To view logs:
   docker-compose logs backend     (backend logs)
   docker-compose logs postgres    (database logs)

docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d
Docker-compose ps
