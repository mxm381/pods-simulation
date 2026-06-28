import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import PODSSimulationEngine from './simulation';

const app: Express = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const simulation = new PODSSimulationEngine();
let isRunning = false;

let lastState = simulation.getState();
simulation.subscribe(state => { lastState = state; });

// ─── Core ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/simulation/state', (_req: Request, res: Response) => {
  res.json({ ...lastState, isRunning });
});

app.get('/api/simulation/metrics', (_req: Request, res: Response) => {
  res.json(simulation.getFinancialMetrics());
});

app.post('/api/simulation/start', (_req: Request, res: Response) => {
  if (!isRunning) { simulation.start(); isRunning = true; }
  res.json({ status: 'started', isRunning });
});

app.post('/api/simulation/stop', (_req: Request, res: Response) => {
  if (isRunning) { simulation.stop(); isRunning = false; }
  res.json({ status: 'stopped', isRunning });
});

app.post('/api/simulation/speed', (req: Request, res: Response) => {
  const { speed } = req.body;
  if (typeof speed !== 'number' || speed < 1 || speed > 365) {
    return res.status(400).json({ error: 'Speed must be 1–365' });
  }
  simulation.setSpeed(speed);
  res.json({ speed, isRunning });
});

// ─── Network ──────────────────────────────────────────────────────────────────

app.get('/api/cities',  (_req: Request, res: Response) => res.json(lastState.cities));
app.get('/api/routes',  (_req: Request, res: Response) => res.json(lastState.routes));
app.get('/api/pods',    (_req: Request, res: Response) => res.json(lastState.pods));
app.get('/api/regions', (_req: Request, res: Response) => res.json(lastState.regions));

app.post('/api/routes/add', (req: Request, res: Response) => {
  const { fromCityId, toCityId, maglev } = req.body;
  if (!fromCityId || !toCityId) return res.status(400).json({ error: 'Missing fields' });
  try {
    res.json(simulation.addRoute(fromCityId, toCityId, maglev || false));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/routes/:routeId/operationalize', (req: Request, res: Response) => {
  try {
    simulation.operationalizeRoute(req.params.routeId);
    res.json({ status: 'operationalized' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

app.get('/api/metrics/history', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 365;
  res.json(lastState.dailyMetrics.slice(-days));
});

app.get('/api/regional-metrics', (_req: Request, res: Response) => {
  res.json(lastState.latestRegionalMetrics);
});

app.get('/api/maintenance', (req: Request, res: Response) => {
  const { active, upcoming } = req.query;
  let events = lastState.maintenanceEvents;
  if (active === 'true')   events = events.filter(e => e.active);
  if (upcoming === 'true') events = events.filter(e => e.startDay > lastState.simulationDay).slice(0, 10);
  res.json(events);
});

app.get('/api/modal-chains', (_req: Request, res: Response) => {
  const recent = lastState.dailyMetrics.slice(-7);
  if (recent.length === 0) return res.json([]);

  // Aggregate last 7 days of modal chains
  const aggregated: Record<string, { chain: string; tripCount: number; avgDistanceKm: number; tripType: string }> = {};
  recent.forEach(d => {
    d.modalChains.forEach(c => {
      if (!aggregated[c.chain]) {
        aggregated[c.chain] = { chain: c.chain, tripCount: 0, avgDistanceKm: c.avgDistanceKm, tripType: c.tripType };
      }
      aggregated[c.chain].tripCount += c.tripCount;
    });
  });

  res.json(Object.values(aggregated).sort((a, b) => b.tripCount - a.tripCount));
});

app.get('/api/capex', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 90;
  const metrics = simulation.getFinancialMetrics();
  const recentLog = lastState.capexLog.slice(-days);
  res.json({ summary: metrics.capexByCategory, log: recentLog, cumulative: metrics.cumulativeCapEx });
});

app.get('/api/demand', (_req: Request, res: Response) => {
  const recent = lastState.dailyMetrics.slice(-30);
  const latest = lastState.dailyMetrics.slice(-1)[0]?.demand ?? null;
  const trend   = recent.map(m => ({ date: m.date, servedTrips: m.demand?.servedTrips ?? 0, fulfillmentRate: m.demand?.fulfillmentRate ?? 0, potentialTrips: m.demand?.potentialTrips ?? 0 }));
  res.json({ latest, trend, coverageByCity: lastState.coverageByCity });
});

app.get('/api/rollout', (_req: Request, res: Response) => {
  const rolloutRoutes = lastState.routes
    .filter(r => r.statusCode !== 'operational')
    .map(r => {
      const from = lastState.cities.find(c => c.id === r.fromCityId);
      const to   = lastState.cities.find(c => c.id === r.toCityId);
      return {
        ...r,
        fromCityName: from?.name,
        toCityName:   to?.name,
        daysUntilOpen: r.estimatedOpenDay
          ? Math.max(0, r.estimatedOpenDay - lastState.simulationDay)
          : null,
      };
    });
  res.json(rolloutRoutes);
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: any, _req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`PODS Simulation API running on http://localhost:${port}`);
});

export default app;
