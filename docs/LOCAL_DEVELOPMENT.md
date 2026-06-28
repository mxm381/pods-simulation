# PODS Simulation - Local Development Guide

Quick start for developing PODS Simulation locally.

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- npm 8+ (comes with Node.js)
- Git
- A text editor or IDE (VS Code recommended)

## Option 1: Quick Start (Recommended)

### 1. Clone and Setup

```bash
git clone https://github.com/<your-username>/pods-simulation.git
cd pods-simulation
bash scripts/setup.sh
```

### 2. Start Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Backend running on http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm start
# Frontend running on http://localhost:3000
```

### 3. Open Dashboard

- Navigate to `http://localhost:3000`
- Click "START" to run the simulation
- Adjust speed (1x, 2x, 4x, 8x) as needed
- Observe real-time metrics and visualizations

## Option 2: Docker (Single Command)

```bash
docker-compose up
# Both services start automatically
# Frontend: http://localhost:3000
# Backend: http://localhost:3001/health
```

## Project Structure

```
pods-simulation/
├── backend/          # API server
│   └── src/
│       ├── simulation.ts   # Core simulation logic
│       └── index.ts        # Express server
├── frontend/         # React dashboard
│   └── src/
│       ├── App.tsx         # Main UI component
│       └── index.tsx       # React entry
└── docs/            # Documentation
```

## Common Development Tasks

### View Backend API

```bash
curl http://localhost:3001/api/simulation/state
curl http://localhost:3001/api/simulation/metrics
```

### Run Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Build for Production

```bash
npm run build  # Builds both backend and frontend
```

### Code Quality

```bash
# Lint
cd backend && npm run lint

# Type check
cd backend && npm run build
cd frontend && npm run build
```

## Debugging

### Backend (Node.js)

Use VS Code debugger:
1. Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Backend Debug",
      "cwd": "${workspaceFolder}/backend",
      "program": "${workspaceFolder}/backend/node_modules/.bin/ts-node",
      "args": ["src/index.ts"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

2. Set breakpoints in `backend/src/simulation.ts`
3. Press F5 to start debugging

### Frontend (React)

1. Open DevTools: F12
2. Open "Sources" tab
3. Set breakpoints in React code
4. Interact with UI to trigger breakpoints

## Environment Variables

Create `.env.local` in project root:

```env
# Backend
NODE_ENV=development
PORT=3001

# Frontend
REACT_APP_API_URL=http://localhost:3001/api
```

## Performance Tips

- Use speed controls (2x, 4x) to progress faster
- Monitor browser DevTools Performance tab
- Backend can handle ~100k pods in memory
- Frontend optimizes for 30-day metric windows

## Common Issues

### Port already in use
```bash
# Kill process on port
lsof -ti:3001 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### npm install fails
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Simulation not responding
1. Check backend is running: `curl http://localhost:3001/health`
2. Check frontend API URL in console logs
3. Restart backend: Kill and re-run `npm run dev`

## IDE Setup (VS Code)

Recommended extensions:
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- TypeScript Vue Plugin
- ESLint
- REST Client

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Workflow

1. **Make changes** to code
2. **Hot reload** automatically refreshes browsers
3. **Test locally**: `npm test`
4. **Commit**: `git add . && git commit -m "..."`
5. **Push**: `git push origin feature-branch`
6. **CI/CD runs** automatically on GitHub

## Next Steps

- Read `README.md` for complete documentation
- Check `docs/GITHUB_DEPLOYMENT.md` for deployment info
- Explore simulation code in `backend/src/simulation.ts`
- Customize dashboard in `frontend/src/App.tsx`

## Support

- Check existing GitHub Issues
- Create a new issue with details
- Include error logs and steps to reproduce

---

**Ready to code?** Start with `npm run dev` and happy hacking! 🚀
