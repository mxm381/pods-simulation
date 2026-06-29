import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const API = 'http://localhost:3001';
const fmt = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d });
const fmtEur = (n: number | null | undefined) =>
  n == null ? '—' : `€${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
const fmtBn = (n: number | null | undefined) =>
  n == null ? '—' : `€${(n / 1_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`;
const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimState {
  simulationDay: number; currentDate: string; isRunning: boolean;
  cities: City[]; routes: Route[]; pods: Pod[];
  dailyMetrics: DailyMetrics[];
  maintenanceEvents: MaintEvent[];
  latestRegionalMetrics: RegionalMetrics[];
  coverageByCity: Record<string, number>;
}
interface City { id: string; name: string; lat: number; lng: number; population: number; regionId: string; }
interface Route { id: string; fromCityId: string; toCityId: string; distanceKm: number; maglev: boolean; statusCode: string; routeType: string; estimatedOpenDay?: number; useExistingRail?: boolean; }
interface Pod { id: string; routeId: string; status: string; currentPassengers: number; capacity: number; batteryPercentage: number; }
interface MaintEvent { id: string; type: string; regionId: string; startDay: number; endDay: number; severity: string; description: string; demandBoostPct: number; active: boolean; }
interface DailyMetrics {
  date: string; totalPassengers: number; totalRevenueEur: number; totalOperatingCostEur: number;
  onTimePerformancePct: number; podUtilizationPercent: number;
  tripsByType: { commute: number; business: number; vacation: number };
  demand?: { servedTrips: number; potentialTrips: number; fulfillmentRate: number; unservedDueToCoverage: number; unservedDueToCapacity: number; avgCoverage: number };
  dailyCapEx: number;
}
interface RegionalMetrics { regionId: string; regionName: string; totalDailyPassengers: number; avgTripDistanceKm: number; onTimePerformancePct: number; dominantTripType: string; activePods: number; operationalRoutes: number; revenueEur: number; coverage: number; }
interface FinMetrics {
  annualProjection: number | null; avgDailyRevenue: number | null; avgDailyOpex: number | null; avgDailyCapEx: number | null;
  profitMargin: number | null; ebitda: number | null;
  cumulativeRevenue: number; cumulativeOpex: number; cumulativeCapEx: number;
  netProfitYtd: number; roi: number | null;
  avgOnTimePerformancePct: number | null; avgRevenuePerPassengerKm: number | null;
  seasonalDemandIndex: number | null; networkReachPct: number; breakEvenDays: number | null;
  capexByCategory: Record<string, number>;
  latestDemand: { servedTrips: number; potentialTrips: number; fulfillmentRate: number; unservedDueToCoverage: number; unservedDueToCapacity: number; avgCoverage: number } | null;
  avgFulfillmentRate: number;
}
interface ModalChain { chain: string; tripCount: number; avgDistanceKm: number; tripType: string; }

interface CandidateCity { id: string; name: string; country: string; lat: number; lng: number; population: number; }
interface ExpansionRec {
  candidate: CandidateCity;
  score: number; reason: string; estimatedDailyDemandGain: number;
  bridgesCorridors: string[];
  suggestedRoutes: { toCity: string; timeSavingPct: number }[];
}
interface InnercityLine { cityId: string; mode: string; name: string; stops: string[]; coverageRadiusKm: number; dailyCapacity: number; operational: boolean; openDay: number; }
interface InnercityNetwork { cityId: string; lines: InnercityLine[]; combinedCoverage: number; dailyLocalTrips: number; }

// ─── Map projection ───────────────────────────────────────────────────────────

const MAP_W = 800, MAP_H = 500;

function computeMapBounds(cities: City[]) {
  if (cities.length === 0) return { latMin: 43, latMax: 58, lngMin: -5, lngMax: 24 };
  const lats = cities.map(c => c.lat);
  const lngs = cities.map(c => c.lng);
  const latPad = 2.5, lngPad = 3.5;
  return {
    latMin: Math.min(...lats) - latPad,
    latMax: Math.max(...lats) + latPad,
    lngMin: Math.min(...lngs) - lngPad,
    lngMax: Math.max(...lngs) + lngPad,
  };
}

function project(lat: number, lng: number, bounds: ReturnType<typeof computeMapBounds>) {
  return {
    x: Math.round(((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * MAP_W),
    y: Math.round(((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * MAP_H),
  };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = '#3b82f6' }:
  { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '14px 18px',
      border: `1px solid ${color}44`,
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<'control'|'financial'|'map'|'operations'|'journey'|'strategy'>('control');
  const [state, setState] = useState<SimState | null>(null);
  const [metrics, setMetrics] = useState<FinMetrics | null>(null);
  const [chains, setChains] = useState<ModalChain[]>([]);
  const [expansions, setExpansions] = useState<ExpansionRec[]>([]);
  const [innercity, setInnercity] = useState<InnercityNetwork[]>([]);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const SPEED_OPTIONS = [
    { label: '1 day / sec', value: 1 },
    { label: '1 week / sec', value: 7 },
    { label: '1 month / sec', value: 30 },
    { label: '1 year / sec', value: 365 },
  ];

  const fetchAll = useCallback(async () => {
    try {
      const [stRes, mRes, cRes, eRes, iRes] = await Promise.all([
        fetch(`${API}/api/simulation/state`),
        fetch(`${API}/api/simulation/metrics`),
        fetch(`${API}/api/modal-chains`),
        fetch(`${API}/api/expansion-recommendations`),
        fetch(`${API}/api/innercity`),
      ]);
      if (!stRes.ok || !mRes.ok) throw new Error('API error');
      const [s, m, c, e, i] = await Promise.all([stRes.json(), mRes.json(), cRes.json(), eRes.json(), iRes.json()]);
      setState(s); setMetrics(m); setChains(c);
      setExpansions(e); setInnercity(i);
      setError(null);
    } catch {
      setError('Cannot reach backend at localhost:3001');
    }
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 1500); return () => clearInterval(t); }, [fetchAll]);

  const post = async (path: string, body?: object) => {
    await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    await fetchAll();
  };

  const handleSpeed = async (v: number) => {
    setSpeed(v);
    if (state?.isRunning) await post('/api/simulation/speed', { speed: v });
  };

  const isRunning = state?.isRunning ?? false;

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'control',   label: '⚙ Control' },
    { key: 'financial', label: '💰 Financial' },
    { key: 'map',       label: '🗺 Map & Network' },
    { key: 'operations',label: '📊 Operations' },
    { key: 'journey',   label: '🚀 Journey Intelligence' },
    { key: 'strategy',  label: '♟ Strategy' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', letterSpacing: -0.5 }}>PODS Simulation</div>
        {state && (
          <>
            <div style={{ fontSize: 13, color: '#64748b' }}>Day {state.simulationDay}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{fmtDate(state.currentDate)}</div>
            <div style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isRunning ? '#10b98120' : '#ef444420', color: isRunning ? '#10b981' : '#ef4444' }}>
              {isRunning ? 'RUNNING' : 'PAUSED'}
            </div>
          </>
        )}
        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
      </div>

      <div style={{ background: '#1e293b', borderBottom: '1px solid #1e293b', padding: '0 24px', display: 'flex', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: tab === t.key ? '#3b82f6' : '#64748b',
            borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'control'    && <ControlTab state={state} metrics={metrics} speed={speed} speedOptions={SPEED_OPTIONS} isRunning={isRunning} onStart={() => post('/api/simulation/start', { speed })} onStop={() => post('/api/simulation/stop')} onSpeed={handleSpeed} />}
        {tab === 'financial'  && <FinancialTab metrics={metrics} history={state?.dailyMetrics ?? []} />}
        {tab === 'map'        && <MapTab state={state} innercity={innercity} />}
        {tab === 'operations' && <OperationsTab state={state} metrics={metrics} />}
        {tab === 'journey'    && <JourneyTab chains={chains} regional={state?.latestRegionalMetrics ?? []} history={state?.dailyMetrics ?? []} />}
        {tab === 'strategy'   && <StrategyTab state={state} metrics={metrics} expansions={expansions} innercity={innercity} onAddCity={async (id) => { await post('/api/cities/add-expansion', { candidateId: id }); }} />}
      </div>
    </div>
  );
}

// ─── Control Tab ──────────────────────────────────────────────────────────────

function ControlTab({ state, metrics, speed, speedOptions, isRunning, onStart, onStop, onSpeed }:
  { state: SimState | null; metrics: FinMetrics | null; speed: number; speedOptions: {label:string;value:number}[]; isRunning: boolean; onStart: ()=>void; onStop: ()=>void; onSpeed: (v:number)=>void }) {
  const pods = state?.pods ?? [];
  const travelingPods = pods.filter(p => p.status === 'traveling').length;
  const opRoutes = state?.routes.filter(r => r.statusCode === 'operational').length ?? 0;

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Simulation Control</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={isRunning ? onStop : onStart} style={{
          padding: '12px 28px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700,
          background: isRunning ? '#ef4444' : '#10b981', color: '#fff',
        }}>{isRunning ? '⏸ Pause Simulation' : '▶ Start Simulation'}</button>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Speed:</span>
          {speedOptions.map(o => (
            <button key={o.value} onClick={() => onSpeed(o.value)} style={{
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${speed === o.value ? '#3b82f6' : '#334155'}`,
              background: speed === o.value ? '#1d4ed8' : '#1e293b', color: speed === o.value ? '#fff' : '#94a3b8',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Fleet Size" value={fmt(pods.length)} sub="total pods" />
        <KPI label="Active Pods" value={fmt(travelingPods)} sub="currently traveling" color="#10b981" />
        <KPI label="Operational Routes" value={fmt(opRoutes)} sub={`of ${state?.routes.length ?? 0} total`} color="#f59e0b" />
        <KPI label="Avg Coverage" value={metrics?.latestDemand ? `${(metrics.latestDemand.avgCoverage * 100).toFixed(1)}%` : '—'} sub="local PODS access" color="#8b5cf6" />
      </div>

      {state && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Pod Fleet Status</div>
            {(['traveling','at_hub','idle','maintenance'] as const).map(s => {
              const count = state.pods.filter(p => p.status === s).length;
              const pct = state.pods.length > 0 ? count / state.pods.length * 100 : 0;
              const col = s === 'traveling' ? '#10b981' : s === 'at_hub' ? '#3b82f6' : s === 'idle' ? '#f59e0b' : '#ef4444';
              return (
                <div key={s} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: col, textTransform: 'capitalize' }}>{s.replace('_', ' ')}</span>
                    <span>{count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#334155', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Route Pipeline</div>
            {(['operational','construction','planning','paused'] as const).map(s => {
              const count = state.routes.filter(r => r.statusCode === s).length;
              const col = s === 'operational' ? '#10b981' : s === 'construction' ? '#f59e0b' : s === 'planning' ? '#3b82f6' : '#ef4444';
              return (
                <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #0f172a' }}>
                  <span style={{ color: col, textTransform: 'capitalize' }}>{s}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Financial Tab ────────────────────────────────────────────────────────────

function FinancialTab({ metrics, history }: { metrics: FinMetrics | null; history: DailyMetrics[] }) {
  if (!metrics) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Start the simulation to see financial data.</div>;

  const m = metrics;
  const chartData = history.slice(-90).map(d => ({
    date: fmtDate(d.date),
    revenue: d.totalRevenueEur / 1_000_000,
    opex: d.totalOperatingCostEur / 1_000_000,
    capex: (d.dailyCapEx || 0) / 1_000_000,
  }));

  const capexCategories = Object.entries(m.capexByCategory).map(([k, v]) => ({
    name: k.replace(/_/g, ' '), value: v / 1_000_000,
  }));

  const demandData = history.slice(-30).map(d => ({
    date: fmtDate(d.date),
    potential: d.demand?.potentialTrips ?? 0,
    served: d.demand?.servedTrips ?? 0,
    fulfillment: (d.demand?.fulfillmentRate ?? 0) * 100,
  }));

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Financial Overview</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Annual Revenue Proj." value={fmtBn(m.annualProjection)} color="#10b981" />
        <KPI label="EBITDA (annual)" value={fmtBn(m.ebitda)} color={m.ebitda != null && m.ebitda > 0 ? '#10b981' : '#ef4444'} />
        <KPI label="Cumulative CapEx" value={fmtBn(m.cumulativeCapEx)} color="#f59e0b" sub="incl. €17.8B historical" />
        <KPI label="ROI on New CapEx" value={m.roi != null ? `${m.roi.toFixed(1)}%` : '—'} color={m.roi != null && m.roi > 0 ? '#10b981' : '#ef4444'} />
        <KPI label="Avg Daily Revenue" value={fmtEur(m.avgDailyRevenue)} color="#3b82f6" />
        <KPI label="Avg Daily OpEx" value={fmtEur(m.avgDailyOpex)} color="#ef4444" />
        <KPI label="Avg Daily CapEx" value={fmtEur(m.avgDailyCapEx)} color="#f59e0b" />
        <KPI label="Profit Margin" value={m.profitMargin != null ? `${m.profitMargin.toFixed(1)}%` : '—'} color={m.profitMargin != null && m.profitMargin > 0 ? '#10b981' : '#ef4444'} />
        <KPI label="Network Reach" value={`${m.networkReachPct}%`} sub="cities with PODS service" color="#8b5cf6" />
        <KPI label="Break-even" value={m.breakEvenDays != null ? `${m.breakEvenDays}d` : '—'} sub="days per new route" color="#06b6d4" />
        <KPI label="Demand Fulfillment" value={`${(m.avgFulfillmentRate * 100).toFixed(1)}%`} sub="served vs potential" color="#ec4899" />
        <KPI label="Revenue / Pax-km" value={m.avgRevenuePerPassengerKm != null ? `€${m.avgRevenuePerPassengerKm.toFixed(3)}` : '—'} color="#3b82f6" />
      </div>

      {/* Pricing tier breakdown */}
      <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Pricing Tier Model</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Commuter Subscription', price: '€149 / month', per: '~€6.77 per trip', color: '#3b82f6', note: 'Flat monthly fee, unlimited local travel. Target: daily commuters.' },
            { label: 'Business Per-Trip',      price: '€0.18 / km',  per: '~€50 per 280km trip', color: '#10b981', note: 'Premium rate for intercity business travel. Price-inelastic segment.' },
            { label: 'Vacation Discount',      price: '€0.07 / km',  per: '~€29 per 420km trip', color: '#f59e0b', note: 'Discounted long-distance leisure. Volume compensates for lower margin.' },
          ].map(t => (
            <div key={t.label} style={{ background: '#0f172a', borderRadius: 8, padding: 14, borderLeft: `3px solid ${t.color}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{t.price}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.per}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>{t.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Daily P&L (last 90 days)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval={14} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `€${v.toFixed(0)}M`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} formatter={(v: number) => `€${v.toFixed(1)}M`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98120" name="Revenue" />
              <Area type="monotone" dataKey="opex"    stroke="#ef4444" fill="#ef444420" name="OpEx" />
              <Area type="monotone" dataKey="capex"   stroke="#f59e0b" fill="#f59e0b20" name="Daily CapEx" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>CapEx by Category</div>
          {capexCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={capexCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {capexCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `€${v.toFixed(1)}M`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 20 }}>CapEx data will appear once simulation starts.</div>
          )}
        </div>
      </div>

      <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Demand Fulfillment (last 30 days)</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={demandData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval={6} />
            <YAxis yAxisId="trips" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area yAxisId="trips" type="monotone" dataKey="potential" stroke="#64748b" fill="#64748b20" name="Potential trips" />
            <Area yAxisId="trips" type="monotone" dataKey="served"    stroke="#10b981" fill="#10b98120" name="Served trips" />
            <Line yAxisId="pct"   type="monotone" dataKey="fulfillment" stroke="#8b5cf6" dot={false} name="Fulfillment %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────

const MODE_COLORS: Record<string, string> = {
  s_bahn: '#3b82f6', u_bahn: '#8b5cf6', tram: '#10b981',
  gondola: '#f59e0b', local_pod_dense: '#ec4899',
};
const MODE_LABELS: Record<string, string> = {
  s_bahn: 'S-Bahn', u_bahn: 'U-Bahn', tram: 'Tram',
  gondola: 'Gondola', local_pod_dense: 'PODS Dense',
};

function InnercitySchematic({ net, cityName }: { net: InnercityNetwork; cityName: string }) {
  const lines = net.lines;
  const ROW_H = 28, PAD_Y = 8, PAD_X = 14, LABEL_W = 52, SVG_W = 340;
  const svgH = lines.length * ROW_H + PAD_Y * 2;
  const trackStart = PAD_X + LABEL_W + 4;
  const trackEnd   = SVG_W - PAD_X;

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{cityName}</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          {(net.combinedCoverage * 100).toFixed(0)}% cov · {(net.dailyLocalTrips / 1000).toFixed(0)}k trips/day
        </div>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${svgH}`} style={{ width: '100%', display: 'block' }}>
        {lines.map((line, i) => {
          const y      = PAD_Y + i * ROW_H + ROW_H / 2;
          const col    = MODE_COLORS[line.mode] ?? '#475569';
          const op     = line.operational;
          const stops  = line.stops ?? [];
          const nStops = stops.length;
          const stopSpacing = nStops > 1 ? (trackEnd - trackStart) / (nStops - 1) : 0;

          return (
            <g key={line.name} opacity={op ? 1 : 0.38}>
              {/* Line name badge */}
              <rect x={PAD_X} y={y - 8} width={LABEL_W} height={16} rx={4} fill={`${col}22`} stroke={col} strokeWidth={0.8} />
              <text x={PAD_X + LABEL_W / 2} y={y + 4} textAnchor="middle" fontSize={8.5} fill={col} fontWeight="bold">{line.name}</text>

              {/* Track */}
              <line x1={trackStart} y1={y} x2={trackEnd} y2={y}
                stroke={col} strokeWidth={op ? 2.5 : 1.5}
                strokeDasharray={op ? undefined : '6 3'} />

              {/* Stops */}
              {stops.map((stop, si) => {
                const sx = trackStart + si * stopSpacing;
                const showLabel = nStops <= 5 || si === 0 || si === nStops - 1;
                return (
                  <g key={si}>
                    <circle cx={sx} cy={y} r={nStops > 8 ? 2 : 3} fill="#0f172a" stroke={col} strokeWidth={1.5} />
                    {showLabel && (
                      <text x={sx} y={si % 2 === 0 ? y - 7 : y + 13} textAnchor="middle" fontSize={6.5}
                        fill="#64748b" style={{ userSelect: 'none' }}>
                        {stop.length > 10 ? stop.slice(0, 10) + '…' : stop}
                      </text>
                    )}
                  </g>
                );
              })}

              {!op && (
                <text x={trackEnd + 2} y={y + 3} fontSize={7.5} fill="#475569">
                  Day {line.openDay}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
        {Array.from(new Set(lines.map(l => l.mode))).map(mode => {
          const modeLines = lines.filter(l => l.mode === mode);
          const opCount   = modeLines.filter(l => l.operational).length;
          const col = MODE_COLORS[mode] ?? '#475569';
          return (
            <span key={mode} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: `${col}20`, color: col }}>
              {MODE_LABELS[mode] ?? mode} {opCount}/{modeLines.length}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MapTab({ state, innercity }: { state: SimState | null; innercity: InnercityNetwork[] }) {
  const [cityMapExpanded, setCityMapExpanded] = useState(false);
  if (!state) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Loading...</div>;

  const routes = state.routes;
  const cities = state.cities;
  const coverage = state.coverageByCity;
  const bounds = computeMapBounds(cities);

  const colorForRoute = (r: Route) => {
    if (r.statusCode === 'operational') return r.useExistingRail ? '#10b981' : r.maglev ? '#3b82f6' : '#10b981';
    if (r.statusCode === 'construction') return '#f59e0b';
    return '#475569';
  };

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Network Map</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
        <div style={{ background: '#1e293b', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: '100%', display: 'block', background: '#0f172a' }}>
            {routes.map(r => {
              const from = cities.find(c => c.id === r.fromCityId);
              const to   = cities.find(c => c.id === r.toCityId);
              if (!from || !to) return null;
              const p1 = project(from.lat, from.lng, bounds);
              const p2 = project(to.lat,   to.lng, bounds);
              return (
                <line key={r.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={colorForRoute(r)} strokeWidth={r.maglev ? 2.5 : 1.5}
                  strokeDasharray={r.statusCode === 'planning' ? '6 4' : r.statusCode === 'construction' ? '3 2' : undefined}
                  opacity={r.statusCode === 'operational' ? 0.85 : 0.55}
                >
                  <title>{from.name} → {to.name} ({r.distanceKm.toFixed(0)}km) [{r.statusCode}]</title>
                </line>
              );
            })}
            {cities.map(c => {
              const p = project(c.lat, c.lng, bounds);
              const cov = coverage[c.id] ?? 0;
              const r  = 6 + cov * 12;
              return (
                <g key={c.id}>
                  <circle cx={p.x} cy={p.y} r={r} fill="#3b82f660" stroke="#3b82f6" strokeWidth={1.5} />
                  <circle cx={p.x} cy={p.y} r={r * cov} fill="#3b82f640" />
                  <text x={p.x} y={p.y - r - 4} textAnchor="middle" fontSize={10} fill="#e2e8f0">{c.name}</text>
                  <text x={p.x} y={p.y + r + 11} textAnchor="middle" fontSize={9} fill="#10b981">{(cov * 100).toFixed(0)}%</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Legend</div>
            {[
              { col: '#3b82f6', dash: false, label: 'New Maglev (operational)' },
              { col: '#10b981', dash: false, label: 'Existing Rail / PODS (operational)' },
              { col: '#f59e0b', dash: true,  label: 'Under construction' },
              { col: '#475569', dash: true,  label: 'Planning' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width={28} height={8}><line x1={0} y1={4} x2={28} y2={4} stroke={l.col} strokeWidth={2} strokeDasharray={l.dash ? '4 3' : undefined} /></svg>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Circle size = coverage level</div>
            <div style={{ fontSize: 12, color: '#10b981' }}>% = local PODS coverage</div>
          </div>

          <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Coverage by City</div>
            {state.cities.map(c => {
              const cov = (coverage[c.id] ?? 0) * 100;
              return (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{c.name}</span><span style={{ color: '#10b981' }}>{cov.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: '#334155', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${cov}%`, background: `hsl(${cov * 1.2},70%,50%)`, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Innercity city maps ────────────────────────────────────────── */}
      <div style={{ background: '#1e293b', borderRadius: 10, border: '1px solid #334155', marginTop: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#10b98115', borderBottom: cityMapExpanded ? '1px solid #334155' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setCityMapExpanded(e => !e)}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>🚇 Innercity Network Maps</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{cityMapExpanded ? '▲ collapse' : '▼ expand'}</div>
        </div>
        {cityMapExpanded && (
          <div style={{ padding: 16 }}>
            {innercity.length === 0
              ? <div style={{ color: '#64748b', fontSize: 13 }}>No innercity data yet. Start simulation.</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                  {innercity.map(net => {
                    const city = state.cities.find(c => c.id === net.cityId);
                    return <InnercitySchematic key={net.cityId} net={net} cityName={city?.name ?? net.cityId} />;
                  })}
                </div>
            }
          </div>
        )}
      </div>

      <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155', marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Route Pipeline</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'left' }}>
                {['Route','Distance','Infra','Status','Open (sim day)'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid #334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map(r => {
                const from = cities.find(c => c.id === r.fromCityId);
                const to   = cities.find(c => c.id === r.toCityId);
                const col  = r.statusCode === 'operational' ? '#10b981' : r.statusCode === 'construction' ? '#f59e0b' : r.statusCode === 'planning' ? '#3b82f6' : '#ef4444';
                const infra = r.useExistingRail ? '🚆 Existing Rail' : r.maglev ? '⚡ New Maglev' : '🛤 Track Upgrade';
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '6px 10px' }}>{from?.name} → {to?.name} <span style={{ color: '#475569', fontSize: 10 }}>{r.distanceKm.toFixed(0)}km</span></td>
                    <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{r.distanceKm.toFixed(0)} km</td>
                    <td style={{ padding: '6px 10px', fontSize: 11 }}>{infra}</td>
                    <td style={{ padding: '6px 10px', color: col, textTransform: 'capitalize' }}>{r.statusCode}</td>
                    <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{r.estimatedOpenDay ? `Day ${r.estimatedOpenDay} (~${(r.estimatedOpenDay/365).toFixed(1)}yr)` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Operations Tab ───────────────────────────────────────────────────────────

function OperationsTab({ state, metrics }: { state: SimState | null; metrics: FinMetrics | null }) {
  if (!state) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Loading...</div>;

  const recent = state.dailyMetrics.slice(-30);
  const otpData = recent.map(d => ({ date: fmtDate(d.date), otp: d.onTimePerformancePct, util: d.podUtilizationPercent }));
  const maint = state.maintenanceEvents.filter(e => e.active || e.startDay > state.simulationDay).slice(0, 15);

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Operations</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="OTP" value={metrics?.avgOnTimePerformancePct != null ? `${metrics.avgOnTimePerformancePct.toFixed(1)}%` : '—'} color="#10b981" sub="on-time performance" />
        <KPI label="Pod Utilization" value={recent.length > 0 ? `${(recent.slice(-1)[0].podUtilizationPercent ?? 0).toFixed(1)}%` : '—'} color="#3b82f6" />
        <KPI label="Active Maintenance" value={String(state.maintenanceEvents.filter(e => e.active).length)} color="#f59e0b" />
        <KPI label="Fleet Size" value={fmt(state.pods.length)} sub="total pods" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>OTP & Utilization (30 days)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={otpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval={6} />
              <YAxis yAxisId="otp"  domain={[90, 100]}  tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
              <YAxis yAxisId="util" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="otp"  type="monotone" dataKey="otp"  stroke="#10b981" dot={false} name="OTP %" />
              <Line yAxisId="util" type="monotone" dataKey="util" stroke="#3b82f6" dot={false} name="Utilization %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Maintenance & Events</div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {maint.length === 0
              ? <div style={{ color: '#64748b', fontSize: 13 }}>No active events.</div>
              : maint.map(e => (
                <div key={e.id} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: '#0f172a', borderLeft: `3px solid ${e.active ? '#f59e0b' : '#334155'}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: e.active ? '#f59e0b' : '#94a3b8' }}>
                    {e.active ? '● ACTIVE' : `Day ${e.startDay}`} — {e.type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{e.description}</div>
                  {e.demandBoostPct !== 0 && (
                    <div style={{ fontSize: 11, color: e.demandBoostPct > 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
                      Demand {e.demandBoostPct > 0 ? '+' : ''}{e.demandBoostPct}%
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Regional Performance</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={state.latestRegionalMetrics} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis dataKey="regionName" type="category" width={140} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="totalDailyPassengers" name="Daily Passengers" fill="#3b82f6" />
            <Bar dataKey="activePods" name="Active Pods" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Journey Tab ──────────────────────────────────────────────────────────────

function JourneyTab({ chains, regional, history }: { chains: ModalChain[]; regional: RegionalMetrics[]; history: DailyMetrics[] }) {
  const tripTrendData = history.slice(-30).map(d => ({
    date: fmtDate(d.date),
    commute:  d.tripsByType?.commute  ?? 0,
    business: d.tripsByType?.business ?? 0,
    vacation: d.tripsByType?.vacation ?? 0,
  }));

  const otpByRegion = regional.map(r => ({ name: r.regionName.replace(' Region','').replace(' Metropolis',''), otp: r.onTimePerformancePct, coverage: r.coverage * 100 }));

  const distByRegion = regional.map(r => ({ name: r.regionName.replace(' Region','').replace(' Metropolis',''), avgDist: r.avgTripDistanceKm }));

  const commuteChains  = chains.filter(c => c.tripType === 'commute');
  const businessChains = chains.filter(c => c.tripType === 'business');
  const vacationChains = chains.filter(c => c.tripType === 'vacation');

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Journey Intelligence</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Top Modal Chains by Trip Type</div>
          {[{ label: 'Commute', data: commuteChains, col: '#3b82f6' }, { label: 'Business', data: businessChains, col: '#10b981' }, { label: 'Vacation', data: vacationChains, col: '#f59e0b' }].map(({ label, data, col }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: col, marginBottom: 6 }}>{label}</div>
              {data.slice(0, 3).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{c.chain}</div>
                  <div style={{ fontSize: 11, color: col, minWidth: 60, textAlign: 'right' }}>{c.tripCount.toLocaleString()} trips</div>
                  <div style={{ fontSize: 11, color: '#64748b', minWidth: 50, textAlign: 'right' }}>{c.avgDistanceKm} km</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Trip Mix Trend (30 days)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={tripTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="commute"  stackId="1" stroke="#3b82f6" fill="#3b82f640" name="Commute" />
              <Area type="monotone" dataKey="business" stackId="1" stroke="#10b981" fill="#10b98140" name="Business" />
              <Area type="monotone" dataKey="vacation" stackId="1" stroke="#f59e0b" fill="#f59e0b40" name="Vacation" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>OTP & Coverage by Region</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={otpByRegion} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="otp"      name="OTP %"      fill="#10b981" />
              <Bar dataKey="coverage" name="Coverage %"  fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8' }}>Avg Trip Distance by Region</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distByRegion} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v} km`} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} formatter={(v: number) => `${v} km`} />
              <Bar dataKey="avgDist" name="Avg distance" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Strategy Tab ─────────────────────────────────────────────────────────────

function StrategyTab({ state, metrics, expansions, innercity, onAddCity }: {
  state: SimState | null; metrics: FinMetrics | null;
  expansions: ExpansionRec[]; innercity: InnercityNetwork[];
  onAddCity: (candidateId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const fulfillment = metrics?.avgFulfillmentRate ?? 0;
  const covGap  = metrics?.latestDemand?.unservedDueToCoverage ?? 0;
  const capGap  = metrics?.latestDemand?.unservedDueToCapacity ?? 0;
  const compGap = (metrics?.latestDemand as any)?.unservedDueToCompetition ?? 0;

  const GAPS = [
    {
      title: 'Hub Location Problem',
      severity: 'high',
      finding: 'All city hubs are modeled as single city-centre points. In reality, placing intercity maglev hubs at Alexanderplatz (Berlin) or Marienplatz (Munich) would be operationally impossible: land cost is prohibitive, road-side access creates congestion, and throughput capacity is capped by urban street grids.',
      scenarios: [
        { label: 'Scenario A — Airport-adjacent hubs', desc: 'Locate intercity hubs next to airports (BER, MUC, FRA). Airports already have land, rail access, and multi-modal transfer infrastructure. Local pod sub-networks bridge city-centre to hub.' },
        { label: 'Scenario B — Ring-of-hubs model', desc: 'Distribute 3–5 smaller hubs per metro area around the orbital motorway ring. Each hub serves a catchment of ~800k people. Reduces first-mile distance, decongests city centres.' },
        { label: 'Scenario C — Motorway-corridor nodes', desc: 'Hubs located at existing motorway service areas / Autobahn intersections. No new land needed. Shuttle pods (local_pod) connect from city centres and suburban zones.' },
      ],
    },
    {
      title: 'Demand Capture Rate (currently 100%)',
      severity: 'high',
      finding: 'The model assumes every trip within PODS coverage converts to a booking. Real capture rates are 30–60% even in optimal conditions. Price, habit, reliability perception, and first-mile friction all suppress conversion.',
      scenarios: [
        { label: 'Pricing tiers', desc: 'Flat €0.10/km works for business trips but overprices commutes vs. public transit. A commuter subscription (€149/month unlimited local) and vacation discount tier would expand addressable market.' },
        { label: 'First-mile incentives', desc: 'Subsidise e-bike and e-scooter legs for commuters (€0.00 first mile). The incremental cost is low vs. the lifetime value of a daily PODS commuter.' },
        { label: 'Corporate accounts', desc: 'B2B accounts for business travel remove per-trip friction. Companies pay monthly; employees book without expense forms. Targets the most price-inelastic segment.' },
      ],
    },
    {
      title: 'Supply–Demand Decoupling',
      severity: 'medium',
      finding: 'Pod dispatch is demand-weighted but still stochastic. Without real-time demand signals, pods can idle on low-demand corridors while high-demand routes run at capacity.',
      scenarios: [
        { label: 'Predictive repositioning', desc: 'Train a lightweight model on 7-day demand history per route × hour. Reposition pods during off-peak hours. Estimated utilisation uplift: 12–18%.' },
        { label: 'Dynamic marshalling yards', desc: 'At hub junctions, pods queue for the next departure rather than returning immediately. Reduces deadhead km, improves availability at peak.' },
      ],
    },
    {
      title: 'Modal Integration Gaps',
      severity: 'medium',
      finding: 'Journey chains assume seamless transfer between modes. In practice, timetable alignment, shared ticketing, and physical co-location are hard. A missed maglev departure adds 20–40 mins — breaking OTP and perceived reliability.',
      scenarios: [
        { label: 'Buffer-time reservations', desc: 'Book local_pod → maglev as a single journey with a 5-min buffer enforced. If local pod is delayed, maglev departure is held (max 3 mins) or next departure is auto-reserved.' },
        { label: 'Unified ticketing SDK', desc: 'One QR code covers the full chain (walk + local pod + maglev + walk). Single-leg cancellations trigger automatic rebooking across all remaining legs.' },
      ],
    },
    {
      title: 'Financial Sustainability',
      severity: covGap > 10000 ? 'high' : 'medium',
      finding: `Historical sunk cost: €17.8B. Current demand fulfillment: ${(fulfillment * 100).toFixed(1)}%. Coverage gap accounts for ${(covGap / Math.max(covGap + capGap, 1) * 100).toFixed(0)}% of unserved demand — the primary lever for revenue growth is network coverage expansion, not adding more pods.`,
      scenarios: [
        { label: 'Coverage-first investment thesis', desc: 'Allocate 60% of local-network CapEx to the 3 lowest-coverage cities. Even a 10pp coverage gain in a city of 1.5M adds ~40k trips/day at €22 avg ticket → €880k/day revenue.' },
        { label: 'Route prioritisation by gravity score', desc: 'New routes should be scored by gravity model potential before planning entry. Avoid building routes where coverage at both endpoints is below 40% — demand will not materialise.' },
      ],
    },
  ];

  const sevColor = (s: string) => s === 'high' ? '#ef4444' : '#f59e0b';

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Strategy & Business Gaps</h2>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Demand Fulfillment" value={`${(fulfillment * 100).toFixed(1)}%`} color={fulfillment > 0.6 ? '#10b981' : '#ef4444'} sub="served vs potential" />
        <KPI label="Unserved (coverage)" value={fmt(covGap)} color="#ef4444" sub="trips lost to no local access" />
        <KPI label="Unserved (capacity)" value={fmt(capGap)} color="#f59e0b" sub="trips lost to full pods" />
        <KPI label="Lost to competition" value={fmt(compGap)} color="#8b5cf6" sub="car/plane wins on time" />
      </div>

      {/* ── Network expansion recommendations ─────────────────────────────── */}
      <div style={{ background: '#1e293b', borderRadius: 10, border: '1px solid #334155', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#3b82f615', borderBottom: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#3b82f6' }}>📍 Network Expansion Recommendations</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Ranked by simulation demand analysis — improve existing cities first, then expand. Cities from real-world European geography, selected by demand gap + corridor bridging + geographic coverage.</div>
        </div>
        <div style={{ padding: 16 }}>
          {expansions.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Run the simulation for 30+ days to generate recommendations.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {expansions.slice(0, 6).map((rec, i) => (
                <div key={rec.candidate.id} style={{ background: '#0f172a', borderRadius: 8, padding: 14, borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>
                      #{i + 1} {rec.candidate.name}
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{rec.candidate.country}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#10b981' }}>+{fmt(rec.estimatedDailyDemandGain)} trips/day</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>{rec.reason}</div>
                  {rec.bridgesCorridors.length > 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b' }}>🔗 Bridges: {rec.bridgesCorridors.slice(0, 2).join(' · ')}</div>
                  )}
                  {rec.suggestedRoutes.length > 0 && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Suggested: {rec.suggestedRoutes.slice(0, 2).map(r => `→${r.toCity}`).join(' ')}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: '#475569' }}>Pop: {(rec.candidate.population / 1_000_000).toFixed(2)}M · Score: {rec.score.toFixed(1)}</div>
                    <button
                      disabled={adding === rec.candidate.id}
                      onClick={async () => { setAdding(rec.candidate.id); await onAddCity(rec.candidate.id); setAdding(null); }}
                      style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #3b82f6', background: adding === rec.candidate.id ? '#1e40af' : 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                    >
                      {adding === rec.candidate.id ? 'Adding…' : '+ Add to Network'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Innercity network status ──────────────────────────────────────── */}
      <div style={{ background: '#1e293b', borderRadius: 10, border: '1px solid #334155', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#10b98115', borderBottom: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#10b981' }}>🚇 Innercity Networks</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>S-Bahn, U-Bahn, tram, gondola and dense PODS urban lines per city. Better innercity coverage = higher hub access = more PODS demand.</div>
        </div>
        <div style={{ padding: 16 }}>
          {innercity.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Loading innercity data…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                    {['City', 'Hub Coverage', 'Daily Local Trips', 'Lines', 'PODS Urban'].map(h => (
                      <th key={h} style={{ padding: '6px 10px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {innercity.map(net => {
                    const city = state?.cities.find(c => c.id === net.cityId);
                    const podsLine = net.lines.find(l => l.mode === 'local_pod_dense');
                    const covPct = net.combinedCoverage * 100;
                    return (
                      <tr key={net.cityId} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#e2e8f0' }}>{city?.name ?? net.cityId}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 60, height: 5, background: '#334155', borderRadius: 3 }}>
                              <div style={{ width: `${covPct}%`, height: '100%', background: `hsl(${covPct * 1.2},70%,50%)`, borderRadius: 3 }} />
                            </div>
                            <span style={{ color: '#10b981' }}>{covPct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{(net.dailyLocalTrips / 1000).toFixed(0)}k</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {net.lines.filter(l => l.operational).map(l => (
                              <span key={l.name} style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10, background: `${MODE_COLORS[l.mode] ?? '#475569'}25`, color: MODE_COLORS[l.mode] ?? '#94a3b8' }}>
                                {MODE_LABELS[l.mode] ?? l.mode}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {podsLine ? (
                            <span style={{ color: podsLine.operational ? '#10b981' : '#f59e0b', fontSize: 11 }}>
                              {podsLine.operational ? `✓ Open (${podsLine.coverageRadiusKm}km radius)` : `Day ${podsLine.openDay}`}
                            </span>
                          ) : <span style={{ color: '#475569' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Business gap analyses ─────────────────────────────────────────── */}
      <div style={{ fontWeight: 700, fontSize: 14, color: '#94a3b8', marginBottom: 12, marginTop: 8 }}>Business Gap Analysis</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {GAPS.map(g => (
          <div key={g.title} style={{ background: '#1e293b', borderRadius: 10, border: `1px solid ${sevColor(g.severity)}33`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', background: `${sevColor(g.severity)}15`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor(g.severity) }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{g.title}</div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: sevColor(g.severity), textTransform: 'uppercase', letterSpacing: 1 }}>{g.severity} priority</div>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 1.6 }}>{g.finding}</div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Solution Scenarios</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.scenarios.map(s => (
                  <div key={s.label} style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 6, borderLeft: '3px solid #334155' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
