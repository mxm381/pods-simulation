import { v4 as uuidv4 } from 'uuid';

// Types
export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
  population: number;
  demandMultiplier: number;
}

export interface Route {
  id: string;
  fromCityId: string;
  toCityId: string;
  distanceKm: number;
  maglev: boolean;
  estimatedMinutes: number;
  capsuleCapacity: number;
  statusCode: 'planning' | 'construction' | 'operational' | 'paused';
  operationalSince?: Date;
}

export interface Pod {
  id: string;
  routeId: string;
  currentPassengers: number;
  capacity: number;
  status: 'idle' | 'traveling' | 'at_hub' | 'maintenance';
  distanceTraveledKm: number;
  totalRevenueEur: number;
  batteryPercentage: number;
}

export interface DailyMetrics {
  date: Date;
  totalPassengers: number;
  totalRevenueEur: number;
  totalOperatingCostEur: number;
  podUtilizationPercent: number;
  routeOperationalPercent: number;
  averageTicketPriceEur: number;
}

export interface SimulationState {
  simulationDay: number;
  currentDate: Date;
  cities: City[];
  routes: Route[];
  pods: Pod[];
  dailyMetrics: DailyMetrics[];
  cumulativeRevenue: number;
  cumulativeOpex: number;
}

export class PODSSimulationEngine {
  private state: SimulationState;
  private dayDurationMs: number = 1000; // 1 real second = 1 day
  private tickInterval: NodeJS.Timeout | null = null;
  private simulationSpeed: number = 1; // 1x, 2x, 4x, 8x
  private subscribers: ((state: SimulationState) => void)[] = [];

  constructor(initialCities: City[] = []) {
    this.state = {
      simulationDay: 0,
      currentDate: new Date('2035-01-01'),
      cities: initialCities,
      routes: [],
      pods: [],
      dailyMetrics: [],
      cumulativeRevenue: 0,
      cumulativeOpex: 0,
    };
    this.initializeDefaultNetwork();
  }

  // Initialize a realistic PODS network (mature state, 2035)
  private initializeDefaultNetwork(): void {
    // Cities in mature PODS network
    const cities: City[] = [
      { id: 'berlin', name: 'Berlin', lat: 52.52, lng: 13.405, population: 3645000, demandMultiplier: 1.2 },
      { id: 'munich', name: 'Munich', lat: 48.1351, lng: 11.582, population: 1471000, demandMultiplier: 1.15 },
      { id: 'frankfurt', name: 'Frankfurt', lat: 50.1109, lng: 8.6821, population: 746000, demandMultiplier: 1.3 },
      { id: 'hamburg', name: 'Hamburg', lat: 53.551, lng: 9.993, population: 1841000, demandMultiplier: 1.1 },
      { id: 'cologne', name: 'Cologne', lat: 50.9365, lng: 6.9594, population: 1085000, demandMultiplier: 1.05 },
      { id: 'amsterdam', name: 'Amsterdam', lat: 52.3676, lng: 4.9041, population: 873000, demandMultiplier: 1.25 },
      { id: 'paris', name: 'Paris', lat: 48.8566, lng: 2.3522, population: 2161000, demandMultiplier: 1.3 },
      { id: 'vienna', name: 'Vienna', lat: 48.2082, lng: 16.3738, population: 1920000, demandMultiplier: 1.15 },
      { id: 'zurich', name: 'Zurich', lat: 47.3769, lng: 8.5472, population: 400000, demandMultiplier: 1.4 },
      { id: 'brussels', name: 'Brussels', lat: 50.8503, lng: 4.3517, population: 1210000, demandMultiplier: 1.2 },
    ];

    this.state.cities = cities;

    // Mature network routes (15 major corridors by 2035)
    const routes: Route[] = [
      // Germany spine
      { id: 'r1', fromCityId: 'berlin', toCityId: 'hamburg', distanceKm: 290, maglev: true, estimatedMinutes: 48, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2031-01-01') },
      { id: 'r2', fromCityId: 'berlin', toCityId: 'frankfurt', distanceKm: 551, maglev: true, estimatedMinutes: 92, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2029-06-01') },
      { id: 'r3', fromCityId: 'frankfurt', toCityId: 'munich', distanceKm: 391, maglev: true, estimatedMinutes: 65, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2034-01-01') },
      { id: 'r4', fromCityId: 'berlin', toCityId: 'munich', distanceKm: 585, maglev: true, estimatedMinutes: 98, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2034-06-01') },
      { id: 'r5', fromCityId: 'hamburg', toCityId: 'cologne', distanceKm: 375, maglev: true, estimatedMinutes: 63, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2032-03-01') },
      
      // Cross-border routes
      { id: 'r6', fromCityId: 'frankfurt', toCityId: 'paris', distanceKm: 586, maglev: true, estimatedMinutes: 98, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2033-09-01') },
      { id: 'r7', fromCityId: 'cologne', toCityId: 'amsterdam', distanceKm: 175, maglev: true, estimatedMinutes: 29, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2032-06-01') },
      { id: 'r8', fromCityId: 'brussels', toCityId: 'amsterdam', distanceKm: 201, maglev: true, estimatedMinutes: 34, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2031-12-01') },
      { id: 'r9', fromCityId: 'frankfurt', toCityId: 'zurich', distanceKm: 279, maglev: true, estimatedMinutes: 47, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2034-03-01') },
      { id: 'r10', fromCityId: 'munich', toCityId: 'vienna', distanceKm: 488, maglev: true, estimatedMinutes: 82, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2033-06-01') },
      
      // Secondary routes
      { id: 'r11', fromCityId: 'berlin', toCityId: 'cologne', distanceKm: 598, maglev: false, estimatedMinutes: 120, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2034-09-01') },
      { id: 'r12', fromCityId: 'paris', toCityId: 'zurich', distanceKm: 483, maglev: false, estimatedMinutes: 96, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2034-01-01') },
      { id: 'r13', fromCityId: 'vienna', toCityId: 'zurich', distanceKm: 657, maglev: false, estimatedMinutes: 130, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2034-06-01') },
      { id: 'r14', fromCityId: 'hamburg', toCityId: 'brussels', distanceKm: 463, maglev: false, estimatedMinutes: 92, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2033-12-01') },
      { id: 'r15', fromCityId: 'cologne', toCityId: 'frankfurt', distanceKm: 180, maglev: false, estimatedMinutes: 36, capsuleCapacity: 4, statusCode: 'operational', operationalSince: new Date('2033-03-01') },
    ];

    this.state.routes = routes;

    // Initialize fleet (4,000 pods in mature network)
    const pods: Pod[] = [];
    for (let i = 0; i < 4000; i++) {
      const routeIdx = i % routes.length;
      pods.push({
        id: `pod-${i}`,
        routeId: routes[routeIdx].id,
        currentPassengers: Math.floor(Math.random() * 3),
        capacity: 4,
        status: ['idle', 'traveling', 'at_hub'][Math.floor(Math.random() * 3)] as any,
        distanceTraveledKm: Math.random() * 50000,
        totalRevenueEur: Math.random() * 500000,
        batteryPercentage: 50 + Math.random() * 50,
      });
    }
    this.state.pods = pods;
  }

  // Main simulation tick
  private tick(): void {
    this.state.simulationDay++;
    this.state.currentDate = new Date(this.state.currentDate.getTime() + 24 * 60 * 60 * 1000);

    // Simulate demand and pod movements
    const dailyMetrics = this.calculateDailyMetrics();
    this.state.dailyMetrics.push(dailyMetrics);
    this.state.cumulativeRevenue += dailyMetrics.totalRevenueEur;
    this.state.cumulativeOpex += dailyMetrics.totalOperatingCostEur;

    // Update pod states
    this.updatePodStates();

    // Notify subscribers
    this.notifySubscribers();
  }

  // Calculate daily metrics
  private calculateDailyMetrics(): DailyMetrics {
    const operationalRoutes = this.state.routes.filter(r => r.statusCode === 'operational').length;
    const totalOperationalRoutes = this.state.routes.length;
    
    // Realistic demand calculation
    const basePassengersPerRoute = 2500; // Average per route per day
    const totalPassengers = operationalRoutes * basePassengersPerRoute + Math.floor(Math.random() * 10000);
    
    // Average ticket price: €0.10/km
    const avgTicketPrice = this.state.routes
      .filter(r => r.statusCode === 'operational')
      .reduce((sum, r) => sum + (r.distanceKm * 0.10), 0) / operationalRoutes;
    
    const totalRevenue = totalPassengers * avgTicketPrice;
    
    // Operating costs: ~€700M-1B annually for mature network
    const annualOpex = 850_000_000; // €850M/year
    const dailyOpex = annualOpex / 365;
    
    // Pod utilization
    const travelingPods = this.state.pods.filter(p => p.status === 'traveling').length;
    const utilizationPercent = (travelingPods / this.state.pods.length) * 100;

    return {
      date: new Date(this.state.currentDate),
      totalPassengers,
      totalRevenueEur: totalRevenue,
      totalOperatingCostEur: dailyOpex,
      podUtilizationPercent: utilizationPercent,
      routeOperationalPercent: (operationalRoutes / totalOperationalRoutes) * 100,
      averageTicketPriceEur: avgTicketPrice,
    };
  }

  // Update pod states (simplified)
  private updatePodStates(): void {
    this.state.pods.forEach(pod => {
      const route = this.state.routes.find(r => r.id === pod.routeId);
      if (!route || route.statusCode !== 'operational') return;

      // Randomly transition states
      const rand = Math.random();
      if (rand < 0.3) {
        pod.status = 'traveling';
        pod.distanceTraveledKm += route.distanceKm / (route.estimatedMinutes / 60);
      } else if (rand < 0.7) {
        pod.status = 'idle';
      } else {
        pod.status = 'at_hub';
        pod.batteryPercentage = Math.min(100, pod.batteryPercentage + 10);
      }

      // Update revenue (simplified: €0.10/km)
      if (pod.status === 'traveling' && pod.currentPassengers > 0) {
        const dailyRevenue = pod.currentPassengers * route.distanceKm * 0.10;
        pod.totalRevenueEur += dailyRevenue;
      }

      // Passenger dynamics
      if (pod.status === 'at_hub') {
        pod.currentPassengers = Math.floor(Math.random() * (pod.capacity + 1));
      }
    });
  }

  // Public API
  public start(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      for (let i = 0; i < this.simulationSpeed; i++) {
        this.tick();
      }
    }, this.dayDurationMs);
  }

  public stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  public setSpeed(speed: number): void {
    this.simulationSpeed = Math.max(1, Math.min(8, speed));
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public addRoute(from: string, to: string, maglev: boolean = false): Route {
    const fromCity = this.state.cities.find(c => c.id === from);
    const toCity = this.state.cities.find(c => c.id === to);
    
    if (!fromCity || !toCity) throw new Error('Invalid city IDs');

    const distanceKm = this.calculateDistance(fromCity.lat, fromCity.lng, toCity.lat, toCity.lng);
    const estimatedMinutes = maglev ? Math.round(distanceKm / 450 * 60) : Math.round(distanceKm / 120 * 60);

    const route: Route = {
      id: uuidv4(),
      fromCityId: from,
      toCityId: to,
      distanceKm,
      maglev,
      estimatedMinutes,
      capsuleCapacity: 4,
      statusCode: 'planning',
    };

    this.state.routes.push(route);
    return route;
  }

  public operationalizeRoute(routeId: string): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (!route) throw new Error('Route not found');
    route.statusCode = 'operational';
    route.operationalSince = new Date(this.state.currentDate);
  }

  public getFinancialMetrics() {
    const recentDays = this.state.dailyMetrics.slice(-365); // Last year
    const avgDailyRevenue = recentDays.reduce((sum, m) => sum + m.totalRevenueEur, 0) / recentDays.length;
    const avgDailyOpex = recentDays.reduce((sum, m) => sum + m.totalOperatingCostEur, 0) / recentDays.length;
    const annualProjection = avgDailyRevenue * 365;
    const profitMargin = ((avgDailyRevenue - avgDailyOpex) / avgDailyRevenue) * 100;

    return {
      annualProjection,
      avgDailyRevenue,
      avgDailyOpex,
      profitMargin,
      cumulativeRevenue: this.state.cumulativeRevenue,
      cumulativeOpex: this.state.cumulativeOpex,
      netProfitYtd: this.state.cumulativeRevenue - this.state.cumulativeOpex,
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public subscribe(callback: (state: SimulationState) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach(callback => callback(state));
  }
}

export default PODSSimulationEngine;
