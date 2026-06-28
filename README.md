# PODS Simulation

A real-time simulation and visualization platform for the PODS (Public Express Delivery System) network in its mature operational state (2035).

## Features

- **Real-time Network Simulation**: Simulate a mature PODS network with 15 routes, 10 major European cities, and 4,000 pods
- **Interactive Dashboard**: Live visualization of network metrics, pod utilization, route status, and financial performance
- **Financial Modeling**: Track revenue, operating costs, and profitability across the network
- **Route Management**: Add new routes, transition them between planning/construction/operational states
- **Fleet Analytics**: Monitor pod distribution, utilization rates, and status across the network
- **Scalable Architecture**: Modular backend and frontend with Docker support

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React 18, TypeScript, TailwindCSS, Recharts
- **Deployment**: Docker, GitHub Actions CI/CD
- **Infrastructure**: GitHub Container Registry, GitHub Actions

## Quick Start

### Local Development

#### Prerequisites
- Node.js 18+
- npm or yarn
- Docker (optional)

#### Setup

1. **Clone the repository**
   ```bash
   git clone <your-github-repo>
   cd pods-simulation
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   npm run dev  # Starts on http://localhost:3001
   ```

3. **Setup Frontend (in another terminal)**
   ```bash
   cd frontend
   npm install
   REACT_APP_API_URL=http://localhost:3001/api npm start  # Starts on http://localhost:3000
   ```

4. **Access Dashboard**
   - Open browser to `http://localhost:3000`

### Docker Development

```bash
docker-compose up
# Backend: http://localhost:3001
# Frontend: http://localhost:3000
```

## API Endpoints

### Simulation Control
- `GET /health` - Health check
- `GET /api/simulation/state` - Get current simulation state
- `GET /api/simulation/metrics` - Get financial metrics
- `POST /api/simulation/start` - Start simulation
- `POST /api/simulation/stop` - Stop simulation
- `POST /api/simulation/speed` - Set simulation speed (1-8x)

### Data Access
- `GET /api/cities` - List all cities
- `GET /api/routes` - List all routes
- `GET /api/pods` - List all pods
- `GET /api/metrics/history?days=365` - Get metrics history

### Route Management
- `POST /api/routes/add` - Create new route
- `POST /api/routes/:routeId/operationalize` - Activate a route

## Simulation Parameters

### Initial Network State (2035)
- **Cities**: 10 major European cities (Berlin, Munich, Frankfurt, etc.)
- **Routes**: 15 operational corridors (maglev + conventional)
- **Pods**: 4,000 autonomous capsules
- **Daily Demand**: ~25,000-35,000 passengers/day
- **Annual Revenue Projection**: €1.5-2.5B
- **Operating Margin**: 20-35%

### Realistic Metrics
- Maglev speed: 450 km/h
- Conventional shuttle: 100-120 km/h
- Pod capacity: 4 passengers
- Ticket price: €0.10/km average
- Operating costs: ~€850M/year for full network

## Project Structure

```
pods-simulation/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── simulation.ts   # Core simulation engine
│   │   └── index.ts        # Express server
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # React dashboard
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── App.css         # Styling
│   │   └── index.tsx       # Entry point
│   └── package.json
├── docker/                  # Docker configs
│   ├── Dockerfile          # Production build
│   └── Dockerfile.dev      # Development build
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # GitHub Actions pipeline
├── docker-compose.yml      # Local development setup
├── .gitignore              # Git ignore rules
├── .env.example            # Environment template
└── README.md               # This file
```

## Deployment to GitHub

### Prerequisites
- GitHub account with a repository
- GitHub Actions enabled

### Setup Steps

1. **Create GitHub Repository**
   ```bash
   git remote add origin https://github.com/<your-username>/pods-simulation.git
   git branch -M main
   git push -u origin main
   ```

2. **Create .env.local (for local secrets, NOT committed)**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with any local settings needed
   ```

3. **GitHub Actions will automatically:**
   - Run tests on push/PR
   - Build Docker image
   - Push to GitHub Container Registry (ghcr.io)

4. **Monitor Deployments**
   - Go to GitHub repo → Actions
   - View CI/CD pipeline progress

### Pull Code from GitHub (Cowork Integration)

In Claude Code/Cowork:
```bash
git clone https://github.com/<your-username>/pods-simulation.git
cd pods-simulation
npm install  # Install root dependencies
cd backend && npm install
cd ../frontend && npm install
npm run dev  # Start development servers
```

## Environment Variables

### Backend (.env)
```
NODE_ENV=development|production
PORT=3001
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ENVIRONMENT=development|production
```

### GitHub Actions Secrets (for deployment)
Add these to your GitHub repository settings under Secrets:
- `REGISTRY_USERNAME` (optional, for custom registries)
- `REGISTRY_PASSWORD` (optional, for custom registries)

**Note**: No API keys or credentials should be stored in `.env` files. Use GitHub Secrets for sensitive data.

## Development Workflow

### Adding Features

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test locally**
   ```bash
   npm run dev  # In respective directory
   npm test
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: describe your change"
   git push origin feature/your-feature-name
   ```

4. **Create Pull Request on GitHub**
   - GitHub Actions runs tests automatically
   - Request review if needed
   - Merge when approved

### Continuous Deployment

Once main branch is updated:
1. GitHub Actions builds the project
2. Docker image is pushed to ghcr.io
3. You can deploy using the image:
   ```bash
   docker pull ghcr.io/<your-username>/pods-simulation:main
   docker run -p 3000:3000 ghcr.io/<your-username>/pods-simulation:main
   ```

## Testing

### Backend Tests
```bash
cd backend
npm test
npm test -- --watch  # Watch mode
```

### Frontend Tests
```bash
cd frontend
npm test
npm test -- --coverage  # With coverage report
```

## Troubleshooting

### Backend not starting
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build
npm run dev
```

### Frontend API connection error
- Check `REACT_APP_API_URL` environment variable
- Ensure backend is running on correct port
- Check browser console for CORS errors

### Docker build failures
```bash
docker-compose down -v  # Remove old containers
docker-compose build --no-cache
docker-compose up
```

## Performance Optimization

### Simulation Speed Tips
- Use 2x/4x speed for faster day progression
- Monitor memory usage with large networks
- Poll interval is 1 second; adjust in App.tsx if needed

### Dashboard Optimization
- Frontend limits chart data to 30 days to reduce re-renders
- Metrics are calculated on-demand
- Large pod counts are handled efficiently

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request with description

## License

MIT License - See LICENSE file

## Support & Questions

- Check GitHub Issues for common problems
- Create a new issue for bugs or feature requests
- Include relevant error messages and steps to reproduce

## Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Advanced scenario modeling (add/remove cities)
- [ ] Historical data export (CSV)
- [ ] Multi-language dashboard
- [ ] Mobile responsive improvements
- [ ] Performance metrics API
- [ ] Integration with external GIS services
- [ ] Machine learning demand prediction

---

**Last Updated**: June 2026  
**Version**: 1.0.0  
**Status**: Production Ready
