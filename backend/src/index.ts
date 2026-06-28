import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import PODSSimulationEngine from './simulation';

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize simulation engine
const simulation = new PODSSimulationEngine();
let isRunning = false;

// Subscribe to state changes (broadcast to WebSocket clients later)
let lastState = simulation.getState();
simulation.subscribe((state) => {
  lastState = state;
});

// Routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get current simulation state
app.get('/api/simulation/state', (req: Request, res: Response) => {
  res.json(lastState);
});

// Get financial metrics
app.get('/api/simulation/metrics', (req: Request, res: Response) => {
  const metrics = simulation.getFinancialMetrics();
  res.json(metrics);
});

// Start simulation
app.post('/api/simulation/start', (req: Request, res: Response) => {
  if (!isRunning) {
    simulation.start();
    isRunning = true;
  }
  res.json({ status: 'started', isRunning });
});

// Stop simulation
app.post('/api/simulation/stop', (req: Request, res: Response) => {
  if (isRunning) {
    simulation.stop();
    isRunning = false;
  }
  res.json({ status: 'stopped', isRunning });
});

// Set simulation speed (1-8x)
app.post('/api/simulation/speed', (req: Request, res: Response) => {
  const { speed } = req.body;
  if (typeof speed !== 'number' || speed < 1 || speed > 8) {
    return res.status(400).json({ error: 'Speed must be between 1 and 8' });
  }
  simulation.setSpeed(speed);
  res.json({ speed, isRunning });
});

// Add new route
app.post('/api/routes/add', (req: Request, res: Response) => {
  const { fromCityId, toCityId, maglev } = req.body;
  if (!fromCityId || !toCityId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const route = simulation.addRoute(fromCityId, toCityId, maglev || false);
    res.json(route);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Operationalize route
app.post('/api/routes/:routeId/operationalize', (req: Request, res: Response) => {
  try {
    simulation.operationalizeRoute(req.params.routeId);
    res.json({ status: 'operationalized' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get cities
app.get('/api/cities', (req: Request, res: Response) => {
  res.json(lastState.cities);
});

// Get routes
app.get('/api/routes', (req: Request, res: Response) => {
  res.json(lastState.routes);
});

// Get pods
app.get('/api/pods', (req: Request, res: Response) => {
  res.json(lastState.pods);
});

// Get daily metrics (history)
app.get('/api/metrics/history', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 365;
  const history = lastState.dailyMetrics.slice(-days);
  res.json(history);
});

// Error handler
app.use((err: any, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`PODS Simulation API running on http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/simulation/state');
  console.log('  GET  /api/simulation/metrics');
  console.log('  POST /api/simulation/start');
  console.log('  POST /api/simulation/stop');
  console.log('  POST /api/simulation/speed { speed: 1-8 }');
  console.log('  POST /api/routes/add { fromCityId, toCityId, maglev }');
  console.log('  POST /api/routes/:routeId/operationalize');
  console.log('  GET  /api/cities');
  console.log('  GET  /api/routes');
  console.log('  GET  /api/pods');
  console.log('  GET  /api/metrics/history?days=365');
});

export default app;
