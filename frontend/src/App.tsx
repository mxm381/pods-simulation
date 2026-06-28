import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface SimulationState {
  simulationDay: number;
  currentDate: string;
  cities: any[];
  routes: any[];
  pods: any[];
  dailyMetrics: any[];
  cumulativeRevenue: number;
  cumulativeOpex: number;
}

interface FinancialMetrics {
  annualProjection: number;
  avgDailyRevenue: number;
  avgDailyOpex: number;
  profitMargin: number;
  cumulativeRevenue: number;
  cumulativeOpex: number;
  netProfitYtd: number;
}

function App() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'utilization' | 'routes'>('revenue');

  // Fetch data
  const fetchState = useCallback(async () => {
    try {
      const stateRes = await axios.get(`${API_BASE}/simulation/state`);
      const metricsRes = await axios.get(`${API_BASE}/simulation/metrics`);
      setState(stateRes.data);
      setMetrics(metricsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  // Set up polling
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1000); // Poll every second
    return () => clearInterval(interval);
  }, [fetchState]);

  // Control simulation
  const handleStart = async () => {
    await axios.post(`${API_BASE}/simulation/start`);
    setIsRunning(true);
  };

  const handleStop = async () => {
    await axios.post(`${API_BASE}/simulation/stop`);
    setIsRunning(false);
  };

  const handleSpeedChange = async (newSpeed: number) => {
    await axios.post(`${API_BASE}/simulation/speed`, { speed: newSpeed });
    setSpeed(newSpeed);
  };

  if (!state || !metrics) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading simulation...</div>;
  }

  // Prepare chart data
  const revenueData = state.dailyMetrics.slice(-30).map(m => ({
    date: new Date(m.date).toLocaleDateString(),
    revenue: Math.round(m.totalRevenueEur),
    opex: Math.round(m.totalOperatingCostEur),
  }));

  const utilizationData = state.dailyMetrics.slice(-30).map(m => ({
    date: new Date(m.date).toLocaleDateString(),
    utilization: Math.round(m.podUtilizationPercent),
    operational: Math.round(m.routeOperationalPercent),
  }));

  const routeStatusData = [
    { name: 'Operational', value: state.routes.filter(r => r.statusCode === 'operational').length, color: '#10b981' },
    { name: 'Construction', value: state.routes.filter(r => r.statusCode === 'construction').length, color: '#f59e0b' },
    { name: 'Planning', value: state.routes.filter(r => r.statusCode === 'planning').length, color: '#6366f1' },
  ];

  const podStatusData = [
    { name: 'Traveling', value: state.pods.filter(p => p.status === 'traveling').length, color: '#3b82f6' },
    { name: 'Idle', value: state.pods.filter(p => p.status === 'idle').length, color: '#8b5cf6' },
    { name: 'At Hub', value: state.pods.filter(p => p.status === 'at_hub').length, color: '#ec4899' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">PODS Simulation Dashboard</h1>
          <p className="text-gray-400">Mature Network State (2035) - Real-time Analytics</p>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Simulation Controls</h2>
              <div className="space-y-3">
                <button
                  onClick={isRunning ? handleStop : handleStart}
                  className={`w-full px-4 py-2 rounded font-semibold transition ${
                    isRunning
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isRunning ? 'STOP' : 'START'} Simulation
                </button>
                <div>
                  <label className="block text-sm mb-2">Speed: {speed}x</label>
                  <div className="flex gap-2">
                    {[1, 2, 4, 8].map(s => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`px-3 py-1 rounded text-sm transition ${
                          speed === s
                            ? 'bg-blue-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Simulation Progress</h2>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-400">Simulation Day:</span> {state.simulationDay}</p>
                <p><span className="text-gray-400">Current Date:</span> {new Date(state.currentDate).toLocaleDateString()}</p>
                <p><span className="text-gray-400">Cities:</span> {state.cities.length}</p>
                <p><span className="text-gray-400">Routes (Operational):</span> {state.routes.filter(r => r.statusCode === 'operational').length}/{state.routes.length}</p>
                <p><span className="text-gray-400">Total Pods:</span> {state.pods.length.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Annual Projection</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(metrics.annualProjection)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Profit Margin</p>
            <p className="text-2xl font-bold text-blue-400">{metrics.profitMargin.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Cumulative Revenue</p>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(metrics.cumulativeRevenue)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Net Profit (YTD)</p>
            <p className="text-2xl font-bold text-yellow-400">{formatCurrency(metrics.netProfitYtd)}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Revenue vs OpEx Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Revenue vs Operating Cost (30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue (EUR)" />
                <Line type="monotone" dataKey="opex" stroke="#ef4444" name="OpEx (EUR)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Pod Utilization Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Pod Utilization & Route Coverage (30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="utilization" stroke="#3b82f6" strokeWidth={2} name="Pod Utilization (%)" />
                <Line type="monotone" dataKey="operational" stroke="#8b5cf6" strokeWidth={2} name="Route Coverage (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Route Status Pie Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Route Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={routeStatusData} dataKey="value" cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80}>
                  {routeStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Pod Status Pie Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Pod Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={podStatusData} dataKey="value" cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value.toLocaleString()}`} outerRadius={80}>
                  {podStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Statistics */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Network Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Avg Daily Revenue</p>
              <p className="text-lg font-semibold">{formatCurrency(metrics.avgDailyRevenue)}</p>
            </div>
            <div>
              <p className="text-gray-400">Avg Daily OpEx</p>
              <p className="text-lg font-semibold">{formatCurrency(metrics.avgDailyOpex)}</p>
            </div>
            <div>
              <p className="text-gray-400">Total Routes</p>
              <p className="text-lg font-semibold">{state.routes.length}</p>
            </div>
            <div>
              <p className="text-gray-400">Total Pods</p>
              <p className="text-lg font-semibold">{state.pods.length.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400">Avg Pod Revenue</p>
              <p className="text-lg font-semibold">{formatCurrency(metrics.cumulativeRevenue / state.pods.length)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
