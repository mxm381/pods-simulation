import { v4 as uuidv4 } from 'uuid';

// ─── Enums & scalars ──────────────────────────────────────────────────────────

export type TripType     = 'commute' | 'business' | 'vacation';
export type TransportMode = 'walk' | 'e_scooter' | 'e_bike' | 'local_pod' | 'regional_pod' | 'intercity_pod' | 'maglev';
export type RouteType    = 'local' | 'regional' | 'intercity' | 'cross_border';
export type MaintType    = 'planned_road' | 'planned_rail' | 'planned_pods' | 'unplanned_pods';
export type CapExCategory = 'r_and_d' | 'route_construction' | 'hub_construction' | 'fleet_acquisition' | 'local_network' | 'technology';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface City {
  id: string; name: string; lat: number; lng: number;
  population: number; demandMultiplier: number; regionId: string;
}

export interface Route {
  id: string; fromCityId: string; toCityId: string;
  distanceKm: number; maglev: boolean; estimatedMinutes: number;
  capsuleCapacity: number;
  statusCode: 'planning' | 'construction' | 'operational' | 'paused';
  operationalSince?: Date; estimatedOpenDay?: number; routeType: RouteType;
}

export interface Pod {
  id: string; routeId: string;
  currentPassengers: number; capacity: number;
  status: 'idle' | 'traveling' | 'at_hub' | 'maintenance';
  distanceTraveledKm: number; totalRevenueEur: number; batteryPercentage: number;
}

export interface Region {
  id: string; name: string; cityIds: string[];
  characterType: 'urban_dense' | 'business_hub' | 'tourism' | 'transit_corridor';
  avgCommuteDistanceKm: number; avgBusinessDistanceKm: number; avgVacationDistanceKm: number;
}

export interface MaintenanceEvent {
  id: string; type: MaintType; routeId?: string; regionId: string;
  startDay: number; endDay: number; severity: 'minor' | 'moderate' | 'major';
  description: string; demandBoostPct: number; otpImpactPct: number; active: boolean;
}

export interface CapExRecord {
  id: string; day: number; date: Date;
  category: CapExCategory; amountEur: number;
  description: string; routeId?: string;
}

export interface TripTypeSplit { commute: number; business: number; vacation: number; }

export interface DemandSnapshot {
  potentialTrips: number;
  servedTrips: number;
  fulfillmentRate: number;          // 0–1
  unservedDueToCoverage: number;
  unservedDueToCapacity: number;
  avgCoverage: number;              // 0–1 across all operational cities
  coverageByCity: Record<string, number>;
}

export interface ModalChainEntry {
  chain: string; tripCount: number; avgDistanceKm: number; tripType: TripType;
}

export interface DailyMetrics {
  date: Date;
  totalPassengers: number;          // served trips
  totalRevenueEur: number;
  totalOperatingCostEur: number;
  podUtilizationPercent: number;
  routeOperationalPercent: number;
  averageTicketPriceEur: number;
  onTimePerformancePct: number;
  tripsByType: TripTypeSplit;
  modalChains: ModalChainEntry[];
  demand: DemandSnapshot;
  demandBoostFromMaintenancePct: number;
  activeMaintenanceCount: number;
  revenuePerPassengerKm: number;
  dailyCapEx: number;
}

export interface RegionalSnapshot {
  regionId: string; regionName: string;
  totalDailyPassengers: number; avgTripDistanceKm: number;
  onTimePerformancePct: number; dominantTripType: TripType;
  activePods: number; operationalRoutes: number; revenueEur: number;
  coverage: number;
}

export interface SimulationState {
  simulationDay: number; currentDate: Date;
  cities: City[]; routes: Route[]; pods: Pod[];
  dailyMetrics: DailyMetrics[];
  cumulativeRevenue: number; cumulativeOpex: number;
  regions: Region[];
  maintenanceEvents: MaintenanceEvent[];
  latestRegionalMetrics: RegionalSnapshot[];
  coverageByCity: Record<string, number>;
  capexLog: CapExRecord[];
  cumulativeCapEx: number;
}

// ─── Modal chain templates ────────────────────────────────────────────────────

const COMMUTE_CHAINS = [
  { chain: ['walk',      'local_pod',    'walk']          as TransportMode[], w: 0.35, km: 12 },
  { chain: ['e_bike',    'local_pod',    'walk']          as TransportMode[], w: 0.25, km: 18 },
  { chain: ['e_scooter', 'local_pod',    'e_scooter']     as TransportMode[], w: 0.20, km: 14 },
  { chain: ['e_bike',    'regional_pod', 'walk']          as TransportMode[], w: 0.20, km: 35 },
];
const BUSINESS_CHAINS = [
  { chain: ['walk',      'local_pod',    'intercity_pod', 'walk']               as TransportMode[], w: 0.30, km: 280 },
  { chain: ['e_scooter', 'regional_pod', 'maglev',        'e_scooter']          as TransportMode[], w: 0.25, km: 380 },
  { chain: ['walk',      'intercity_pod', 'walk']                               as TransportMode[], w: 0.20, km: 220 },
  { chain: ['e_bike',    'local_pod',    'maglev',        'local_pod','e_scooter'] as TransportMode[], w: 0.25, km: 450 },
];
const VACATION_CHAINS = [
  { chain: ['walk',   'local_pod',    'maglev',        'local_pod',    'walk']   as TransportMode[], w: 0.40, km: 480 },
  { chain: ['e_bike', 'regional_pod', 'maglev',        'regional_pod', 'e_bike'] as TransportMode[], w: 0.30, km: 550 },
  { chain: ['walk',   'local_pod',    'intercity_pod', 'local_pod',    'walk']   as TransportMode[], w: 0.30, km: 320 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}
function poisson(lambda: number): boolean {
  // true with probability 1 - e^(-lambda) per tick; approximate for small lambda
  return Math.random() < 1 - Math.exp(-lambda);
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class PODSSimulationEngine {
  private state: SimulationState;
  private dayDurationMs = 1000;
  private tickInterval: NodeJS.Timeout | null = null;
  private simulationSpeed = 1;
  private subscribers: ((s: SimulationState) => void)[] = [];

  // Historical sunk cost before simulation starts
  private static readonly HISTORICAL_CAPEX_EUR = 17_800_000_000;

  constructor() {
    this.state = {
      simulationDay: 0, currentDate: new Date('2035-01-01'),
      cities: [], routes: [], pods: [],
      dailyMetrics: [], cumulativeRevenue: 0, cumulativeOpex: 0,
      regions: [], maintenanceEvents: [], latestRegionalMetrics: [],
      coverageByCity: {}, capexLog: [],
      cumulativeCapEx: PODSSimulationEngine.HISTORICAL_CAPEX_EUR,
    };
    this.initNetwork();
    this.seedMaintenance();
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  private initNetwork(): void {
    this.state.regions = [
      { id: 'berlin',     name: 'Berlin Capital Region',   cityIds: ['berlin'],                           characterType: 'business_hub',      avgCommuteDistanceKm: 22,  avgBusinessDistanceKm: 340, avgVacationDistanceKm: 520 },
      { id: 'north',      name: 'Northern Germany',        cityIds: ['hamburg'],                          characterType: 'transit_corridor',   avgCommuteDistanceKm: 18,  avgBusinessDistanceKm: 290, avgVacationDistanceKm: 480 },
      { id: 'rhine_ruhr', name: 'Rhine-Ruhr Metropolis',  cityIds: ['cologne','amsterdam','brussels'],   characterType: 'urban_dense',        avgCommuteDistanceKm: 15,  avgBusinessDistanceKm: 180, avgVacationDistanceKm: 420 },
      { id: 'frankfurt',  name: 'Frankfurt Finance Hub',   cityIds: ['frankfurt'],                        characterType: 'business_hub',       avgCommuteDistanceKm: 25,  avgBusinessDistanceKm: 380, avgVacationDistanceKm: 560 },
      { id: 'bavaria',    name: 'Bavaria & Alps',          cityIds: ['munich','vienna','zurich'],         characterType: 'tourism',            avgCommuteDistanceKm: 20,  avgBusinessDistanceKm: 310, avgVacationDistanceKm: 620 },
      { id: 'paris',      name: 'Greater Paris Region',    cityIds: ['paris'],                            characterType: 'business_hub',       avgCommuteDistanceKm: 28,  avgBusinessDistanceKm: 420, avgVacationDistanceKm: 680 },
    ];

    this.state.cities = [
      { id: 'berlin',    name: 'Berlin',    lat: 52.52,   lng: 13.405, population: 3_645_000, demandMultiplier: 1.20, regionId: 'berlin' },
      { id: 'munich',    name: 'Munich',    lat: 48.1351, lng: 11.582, population: 1_471_000, demandMultiplier: 1.15, regionId: 'bavaria' },
      { id: 'frankfurt', name: 'Frankfurt', lat: 50.1109, lng: 8.6821, population:   746_000, demandMultiplier: 1.30, regionId: 'frankfurt' },
      { id: 'hamburg',   name: 'Hamburg',   lat: 53.551,  lng: 9.993,  population: 1_841_000, demandMultiplier: 1.10, regionId: 'north' },
      { id: 'cologne',   name: 'Cologne',   lat: 50.9365, lng: 6.9594, population: 1_085_000, demandMultiplier: 1.05, regionId: 'rhine_ruhr' },
      { id: 'amsterdam', name: 'Amsterdam', lat: 52.3676, lng: 4.9041, population:   873_000, demandMultiplier: 1.25, regionId: 'rhine_ruhr' },
      { id: 'paris',     name: 'Paris',     lat: 48.8566, lng: 2.3522, population: 2_161_000, demandMultiplier: 1.30, regionId: 'paris' },
      { id: 'vienna',    name: 'Vienna',    lat: 48.2082, lng: 16.374, population: 1_920_000, demandMultiplier: 1.15, regionId: 'bavaria' },
      { id: 'zurich',    name: 'Zurich',    lat: 47.3769, lng: 8.5472, population:   400_000, demandMultiplier: 1.40, regionId: 'bavaria' },
      { id: 'brussels',  name: 'Brussels',  lat: 50.8503, lng: 4.3517, population: 1_210_000, demandMultiplier: 1.20, regionId: 'rhine_ruhr' },
    ];

    const mkRoute = (id: string, f: string, t: string, km: number, maglev: boolean, mins: number, status: Route['statusCode'], type: RouteType, openDay?: number): Route => ({
      id, fromCityId: f, toCityId: t, distanceKm: km, maglev, estimatedMinutes: mins,
      capsuleCapacity: 4, statusCode: status,
      operationalSince: status === 'operational' ? new Date('2034-01-01') : undefined,
      estimatedOpenDay: openDay, routeType: type,
    });

    this.state.routes = [
      // ── Operational maglev ─────────────────────────────────────────────────
      mkRoute('r1',  'berlin',    'hamburg',   290, true,  48, 'operational', 'intercity'),
      mkRoute('r2',  'berlin',    'frankfurt', 551, true,  92, 'operational', 'intercity'),
      mkRoute('r3',  'frankfurt', 'munich',    391, true,  65, 'operational', 'intercity'),
      mkRoute('r4',  'berlin',    'munich',    585, true,  98, 'operational', 'intercity'),
      mkRoute('r5',  'hamburg',   'cologne',   375, true,  63, 'operational', 'intercity'),
      mkRoute('r6',  'frankfurt', 'paris',     586, true,  98, 'operational', 'cross_border'),
      mkRoute('r7',  'cologne',   'amsterdam', 175, true,  29, 'operational', 'cross_border'),
      mkRoute('r8',  'brussels',  'amsterdam', 201, true,  34, 'operational', 'cross_border'),
      mkRoute('r9',  'frankfurt', 'zurich',    279, true,  47, 'operational', 'cross_border'),
      mkRoute('r10', 'munich',    'vienna',    488, true,  82, 'operational', 'cross_border'),
      // ── Operational standard ───────────────────────────────────────────────
      mkRoute('r11', 'berlin',    'cologne',   598, false, 120,'operational', 'intercity'),
      mkRoute('r12', 'paris',     'zurich',    483, false,  96,'operational', 'cross_border'),
      mkRoute('r13', 'vienna',    'zurich',    657, false, 130,'operational', 'cross_border'),
      mkRoute('r14', 'hamburg',   'brussels',  463, false,  92,'operational', 'cross_border'),
      mkRoute('r15', 'cologne',   'frankfurt', 180, false,  36,'operational', 'regional'),
      // ── Rollout ────────────────────────────────────────────────────────────
      mkRoute('r16', 'paris',    'amsterdam',  507, true,  85, 'construction', 'cross_border', 45),
      mkRoute('r17', 'berlin',   'vienna',     690, true, 115, 'construction', 'cross_border', 90),
      mkRoute('r18', 'hamburg',  'frankfurt',  490, true,  82, 'planning',     'intercity',    150),
      mkRoute('r19', 'brussels', 'frankfurt',  280, true,  47, 'planning',     'cross_border', 200),
      mkRoute('r20', 'zurich',   'vienna',     320, true,  54, 'planning',     'cross_border', 270),
    ];

    // Coverage: operational cities start at 62%; non-operational at 20%
    const opCities = new Set(
      this.state.routes
        .filter(r => r.statusCode === 'operational')
        .flatMap(r => [r.fromCityId, r.toCityId])
    );
    this.state.cities.forEach(c => {
      this.state.coverageByCity[c.id] = opCities.has(c.id) ? 0.62 : 0.20;
    });

    // Fleet: 4 000 pods across operational routes
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    for (let i = 0; i < 4000; i++) {
      const route = opRoutes[i % opRoutes.length];
      this.state.pods.push({
        id: `pod-${i}`,
        routeId: route.id,
        currentPassengers: Math.floor(Math.random() * 3),
        capacity: 4,
        status: (['idle','traveling','at_hub'] as const)[Math.floor(Math.random() * 3)],
        distanceTraveledKm: Math.random() * 50_000,
        totalRevenueEur: Math.random() * 500_000,
        batteryPercentage: 50 + Math.random() * 50,
      });
    }
  }

  private seedMaintenance(): void {
    // Pre-generate a rolling calendar of events out to day 60
    this.scheduleMaintenance(0, 60);
  }

  private scheduleMaintenance(fromDay: number, toDay: number): void {
    const regions = this.state.regions;
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');

    const templates = [
      { type: 'planned_road'  as MaintType, sev: 'minor'    as const, days: 4,  boost:  8, otp:  0.0, desc: (r: string) => `Road resurfacing in ${r} — commuters shifting to PODS` },
      { type: 'planned_road'  as MaintType, sev: 'moderate' as const, days: 7,  boost: 15, otp:  0.0, desc: (r: string) => `Bridge works in ${r} — modal shift to PODS expected` },
      { type: 'planned_rail'  as MaintType, sev: 'moderate' as const, days: 5,  boost: 22, otp:  0.0, desc: (r: string) => `DB track renewal near ${r} — rail passengers diverted` },
      { type: 'planned_rail'  as MaintType, sev: 'major'    as const, days: 10, boost: 38, otp:  0.0, desc: (r: string) => `ICE corridor upgrade in ${r} — large-scale diversion to PODS` },
      { type: 'planned_pods'  as MaintType, sev: 'minor'    as const, days: 2,  boost: -5, otp: -0.4, desc: (r: string) => `Scheduled PODS hub maintenance in ${r}` },
      { type: 'unplanned_pods'as MaintType, sev: 'moderate' as const, days: 1,  boost:-10, otp: -0.9, desc: (r: string) => `Unplanned PODS track inspection in ${r}` },
    ];

    let next = fromDay + 8 + Math.floor(Math.random() * 8);
    while (next < toDay) {
      const t = pick(templates);
      const region = pick(regions);
      let routeId: string | undefined;
      if ((t.type === 'planned_pods' || t.type === 'unplanned_pods') && opRoutes.length > 0) {
        const regional = opRoutes.filter(r =>
          region.cityIds.includes(r.fromCityId) || region.cityIds.includes(r.toCityId)
        );
        routeId = pick(regional.length > 0 ? regional : opRoutes).id;
      }
      this.state.maintenanceEvents.push({
        id: uuidv4(), type: t.type, routeId, regionId: region.id,
        startDay: next, endDay: next + t.days,
        severity: t.sev, description: t.desc(region.name),
        demandBoostPct: t.boost, otpImpactPct: t.otp, active: false,
      });
      next += 12 + Math.floor(Math.random() * 13);
    }
  }

  // ─── Tick ──────────────────────────────────────────────────────────────────

  private tick(): void {
    this.state.simulationDay++;
    this.state.currentDate = new Date(this.state.currentDate.getTime() + 86_400_000);

    this.processRollout();
    this.updateMaintenance();
    this.generateDynamicEvents();       // ← NEW: events emerge from state
    this.evolveCoverage();              // ← NEW: coverage improves over time
    const capex = this.processCapEx();  // ← NEW: CapEx accrues daily

    const metrics = this.buildDailyMetrics(capex);
    this.state.dailyMetrics.push(metrics);
    this.state.cumulativeRevenue += metrics.totalRevenueEur;
    this.state.cumulativeOpex   += metrics.totalOperatingCostEur;
    this.state.cumulativeCapEx  += capex;

    this.updatePodStates(metrics.totalPassengers);   // demand-driven dispatch
    this.state.latestRegionalMetrics = this.computeRegional(metrics);
    this.notifySubscribers();
  }

  // ─── Rollout ───────────────────────────────────────────────────────────────

  private processRollout(): void {
    this.state.routes.forEach(r => {
      if (r.statusCode === 'planning' && r.estimatedOpenDay && this.state.simulationDay >= r.estimatedOpenDay - 30) {
        r.statusCode = 'construction';
        // Record construction CapEx at start of construction
        const cost = r.routeType === 'cross_border' ? 900_000_000 : r.routeType === 'intercity' ? 700_000_000 : 300_000_000;
        this.addCapEx('route_construction', cost, `Construction start: ${r.fromCityId}→${r.toCityId}`, r.id);
      }
      if (r.statusCode === 'construction' && r.estimatedOpenDay && this.state.simulationDay >= r.estimatedOpenDay) {
        r.statusCode = 'operational';
        r.operationalSince = new Date(this.state.currentDate);
        this.spawnPodsForRoute(r);
        // Coverage boost for newly connected cities
        [r.fromCityId, r.toCityId].forEach(cid => {
          if ((this.state.coverageByCity[cid] ?? 0) < 0.55)
            this.state.coverageByCity[cid] = 0.55;
        });
      }
    });
  }

  private spawnPodsForRoute(route: Route): void {
    const count = 180 + Math.floor(Math.random() * 60);
    const costPerPod = 180_000;
    this.addCapEx('fleet_acquisition', count * costPerPod, `Fleet for new route ${route.fromCityId}→${route.toCityId}`, route.id);
    for (let i = 0; i < count; i++) {
      this.state.pods.push({
        id: `pod-${uuidv4().slice(0,8)}`,
        routeId: route.id,
        currentPassengers: 0, capacity: 4,
        status: 'idle',
        distanceTraveledKm: 0, totalRevenueEur: 0,
        batteryPercentage: 98 + Math.random() * 2,
      });
    }
  }

  // ─── Maintenance ───────────────────────────────────────────────────────────

  private updateMaintenance(): void {
    const day = this.state.simulationDay;
    this.state.maintenanceEvents.forEach(ev => {
      ev.active = ev.startDay <= day && day <= ev.endDay;
      if (ev.routeId && (ev.type === 'planned_pods' || ev.type === 'unplanned_pods')) {
        const route = this.state.routes.find(r => r.id === ev.routeId);
        if (route) {
          if (ev.active && route.statusCode === 'operational') route.statusCode = 'paused';
          if (!ev.active && route.statusCode === 'paused')     route.statusCode = 'operational';
        }
      }
    });
  }

  // ─── Dynamic event generation (each tick) ─────────────────────────────────
  // Events now emerge from simulation state rather than a static calendar.

  private generateDynamicEvents(): void {
    const day = this.state.simulationDay;

    // 1. Extend maintenance calendar: keep at least 60 future days scheduled
    const maxScheduled = Math.max(...this.state.maintenanceEvents.map(e => e.endDay), day);
    if (maxScheduled < day + 60) {
      this.scheduleMaintenance(maxScheduled, maxScheduled + 80);
    }

    // 2. Demand-triggered new route planning
    // If a city pair has no route and both cities are well-covered (>0.7), propose a new route
    if (poisson(1 / 90) && this.state.dailyMetrics.length > 30) {
      this.tryProposeNewRoute();
    }

    // 3. Random demand spike (trade fair, sports event, national holiday)
    if (poisson(1 / 45)) {
      const region = pick(this.state.regions);
      const spike = 15 + Math.floor(Math.random() * 30); // 15–45% boost
      const dur = 3 + Math.floor(Math.random() * 5);
      this.state.maintenanceEvents.push({
        id: uuidv4(), type: 'planned_road', routeId: undefined,
        regionId: region.id, startDay: day, endDay: day + dur,
        severity: 'minor',
        description: `Demand spike in ${region.name} (event / holiday)`,
        demandBoostPct: spike, otpImpactPct: 0, active: true,
      });
    }

    // 4. Major road disruption (rare, large boost)
    if (poisson(1 / 120)) {
      const region = pick(this.state.regions);
      this.state.maintenanceEvents.push({
        id: uuidv4(), type: 'planned_road', routeId: undefined,
        regionId: region.id, startDay: day, endDay: day + 14,
        severity: 'major',
        description: `Major road closure in ${region.name} — extended PODS demand surge`,
        demandBoostPct: 45, otpImpactPct: -0.2, active: true,
      });
    }

    // 5. Unplanned PODS incident
    if (poisson(1 / 70)) {
      const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
      if (opRoutes.length > 0) {
        const route = pick(opRoutes);
        const region = this.state.regions.find(r =>
          r.cityIds.includes(route.fromCityId) || r.cityIds.includes(route.toCityId)
        )!;
        this.state.maintenanceEvents.push({
          id: uuidv4(), type: 'unplanned_pods', routeId: route.id,
          regionId: region.id, startDay: day, endDay: day + 1,
          severity: 'moderate',
          description: `Unplanned PODS incident on ${route.fromCityId}→${route.toCityId} corridor`,
          demandBoostPct: -8, otpImpactPct: -1.2, active: true,
        });
      }
    }

    // 6. Technology breakthrough (very rare — reduces OpEx or boosts coverage)
    if (poisson(1 / 300)) {
      this.addCapEx('technology', 200_000_000, 'Technology upgrade programme');
      // Coverage boost across all cities
      Object.keys(this.state.coverageByCity).forEach(cid => {
        this.state.coverageByCity[cid] = Math.min(1, (this.state.coverageByCity[cid] ?? 0) + 0.05);
      });
    }
  }

  private tryProposeNewRoute(): void {
    // Find the highest-demand city pair without a direct route
    const existingPairs = new Set(
      this.state.routes.map(r => `${r.fromCityId}-${r.toCityId}`)
    );
    const candidates: { a: City; b: City; score: number }[] = [];

    for (let i = 0; i < this.state.cities.length; i++) {
      for (let j = i + 1; j < this.state.cities.length; j++) {
        const a = this.state.cities[i], b = this.state.cities[j];
        if (existingPairs.has(`${a.id}-${b.id}`) || existingPairs.has(`${b.id}-${a.id}`)) continue;
        const cov = ((this.state.coverageByCity[a.id] ?? 0) + (this.state.coverageByCity[b.id] ?? 0)) / 2;
        if (cov < 0.5) continue;
        const dist = this.haversine(a.lat, a.lng, b.lat, b.lng);
        const score = Math.sqrt(a.population * b.population) / dist * cov;
        candidates.push({ a, b, score });
      }
    }
    if (candidates.length === 0) return;
    candidates.sort((x, y) => y.score - x.score);
    const best = candidates[0];
    const dist = this.haversine(best.a.lat, best.a.lng, best.b.lat, best.b.lng);
    const openDay = this.state.simulationDay + 60 + Math.floor(Math.random() * 60);
    const routeType: RouteType = best.a.regionId !== best.b.regionId ? 'cross_border'
      : dist < 200 ? 'regional' : 'intercity';
    this.state.routes.push({
      id: `r-dyn-${uuidv4().slice(0,6)}`,
      fromCityId: best.a.id, toCityId: best.b.id,
      distanceKm: dist, maglev: dist > 200,
      estimatedMinutes: Math.round(dist / (dist > 200 ? 450 : 120) * 60),
      capsuleCapacity: 4, statusCode: 'planning',
      estimatedOpenDay: openDay, routeType,
    });
  }

  // ─── Coverage evolution ────────────────────────────────────────────────────

  private evolveCoverage(): void {
    // Organic growth: each operational city gains coverage from local-network investment
    const opCities = new Set(
      this.state.routes
        .filter(r => r.statusCode === 'operational')
        .flatMap(r => [r.fromCityId, r.toCityId])
    );
    opCities.forEach(cid => {
      const current = this.state.coverageByCity[cid] ?? 0.5;
      if (current < 0.95) {
        // Logistic growth: fast early, slows near saturation
        const growth = 0.0008 * (1 - current);
        this.state.coverageByCity[cid] = Math.min(0.95, current + growth);
      }
    });

    // Local-network investment event: every ~50 days, a city gets a targeted boost
    if (poisson(1 / 50) && this.state.dailyMetrics.length > 0) {
      const city = pick(this.state.cities.filter(c => (this.state.coverageByCity[c.id] ?? 0) < 0.80));
      if (city) {
        this.state.coverageByCity[city.id] = Math.min(0.95, (this.state.coverageByCity[city.id] ?? 0.5) + 0.07);
        this.addCapEx('local_network', 35_000_000, `Local hub expansion in ${city.name}`, undefined);
      }
    }
  }

  // ─── CapEx accrual ────────────────────────────────────────────────────────

  private processCapEx(): number {
    const day = this.state.simulationDay;
    let total = 0;

    // R&D: €2.8M/day, declining slightly over time
    const rdDecay = Math.max(0.5, 1 - day / 2000);
    const rdAmount = 2_800_000 * rdDecay;
    total += this.addCapEx('r_and_d', rdAmount, `Daily R&D (day ${day})`);

    // Infrastructure maintenance provision: €180k/day per route in construction
    const constructionRoutes = this.state.routes.filter(r => r.statusCode === 'construction').length;
    if (constructionRoutes > 0) {
      total += this.addCapEx('route_construction', constructionRoutes * 180_000, `Construction day costs (${constructionRoutes} routes)`);
    }

    return total;
  }

  private addCapEx(category: CapExCategory, amount: number, desc: string, routeId?: string): number {
    const record: CapExRecord = {
      id: uuidv4(), day: this.state.simulationDay,
      date: new Date(this.state.currentDate),
      category, amountEur: amount, description: desc, routeId,
    };
    this.state.capexLog.push(record);
    // Only keep last 365 records in memory to avoid unbounded growth
    if (this.state.capexLog.length > 365) this.state.capexLog.shift();
    return amount;
  }

  // ─── Demand model ─────────────────────────────────────────────────────────
  // Trips are now generated from a gravity model, then filtered through
  // coverage (can the user even request PODS at their location?) and
  // capacity (are there pods available?).

  private buildDemand(): DemandSnapshot {
    const GRAVITY_K = 200; // calibrated: ~600k served trips/day at full maturity
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    const recentOtp = this.recentAvgOtp();
    const otpFactor = this.otpToDemandFactor(recentOtp);
    // Network effect: more routes = platform gets more attractive
    const networkEffect = Math.min(1.5, 1 + opRoutes.length / 25);

    // Maintenance demand boost
    const activeEvents = this.state.maintenanceEvents.filter(e => e.active);
    const boostPct = activeEvents.reduce((s, e) => s + e.demandBoostPct, 0);
    const maintBoost = 1 + boostPct / 100;

    // Seasonal
    const dayOfYear = this.state.simulationDay % 365;
    const seasonal = 1 + 0.08 * Math.sin((dayOfYear / 365) * 2 * Math.PI);

    let potential = 0, unservedCov = 0, unservedCap = 0, served = 0;
    const servedByRoute: Record<string, number> = {};

    opRoutes.forEach(route => {
      const from = this.state.cities.find(c => c.id === route.fromCityId)!;
      const to   = this.state.cities.find(c => c.id === route.toCityId)!;

      // Gravity: sqrt of population product / distance (bidirectional)
      const gravPotential = Math.round(
        GRAVITY_K * Math.sqrt(from.population * to.population) / route.distanceKm
        * from.demandMultiplier * to.demandMultiplier * networkEffect * seasonal * maintBoost * 2
      );

      // Coverage filter: weakest-end rule
      // A trip is only possible if BOTH origin AND destination have local PODS access
      const covFrom = this.state.coverageByCity[from.id] ?? 0.5;
      const covTo   = this.state.coverageByCity[to.id]   ?? 0.5;
      const covFactor = this.coverageToDemandFactor(Math.min(covFrom, covTo));
      const afterCoverage = gravPotential * covFactor;

      // OTP filter
      const afterOtp = afterCoverage * otpFactor;

      unservedCov += gravPotential - afterCoverage;

      // Capacity: pods × trips per day × avg capacity × seat utilisation target
      const routePods = this.state.pods.filter(p => p.routeId === route.id && p.status !== 'maintenance');
      const tripsPerPodPerDay = route.distanceKm < 200 ? 14 : route.distanceKm < 400 ? 8 : 5;
      const maxCap = routePods.length * tripsPerPodPerDay * route.capsuleCapacity * 0.72;

      const routeServed = Math.min(afterOtp, maxCap);
      unservedCap += Math.max(0, afterOtp - maxCap);

      potential += gravPotential;
      served    += routeServed;
      servedByRoute[route.id] = Math.round(routeServed);
    });

    const coverageValues = Object.values(this.state.coverageByCity);
    const avgCoverage = coverageValues.length > 0
      ? coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length : 0;

    return {
      potentialTrips:          Math.round(potential),
      servedTrips:             Math.round(served),
      fulfillmentRate:         potential > 0 ? Math.round(served / potential * 1000) / 1000 : 0,
      unservedDueToCoverage:   Math.round(unservedCov),
      unservedDueToCapacity:   Math.round(unservedCap),
      avgCoverage:             Math.round(avgCoverage * 1000) / 1000,
      coverageByCity:          { ...this.state.coverageByCity },
    };
  }

  private coverageToDemandFactor(cov: number): number {
    if (cov < 0.20) return cov * 0.25;              // 0 → 5%
    if (cov < 0.50) return 0.05 + (cov - 0.20) / 0.30 * 0.45; // 5 → 50%
    if (cov < 0.80) return 0.50 + (cov - 0.50) / 0.30 * 0.40; // 50 → 90%
    return              0.90 + (cov - 0.80) / 0.20 * 0.09;     // 90 → 99%
  }

  private otpToDemandFactor(otp: number): number {
    if (otp >= 98.5) return 1.05;
    if (otp >= 97.0) return 1.00;
    if (otp >= 95.0) return 0.95;
    if (otp >= 92.0) return 0.85;
    return 0.70;
  }

  private recentAvgOtp(): number {
    const recent = this.state.dailyMetrics.slice(-30);
    return recent.length > 0
      ? recent.reduce((s, m) => s + m.onTimePerformancePct, 0) / recent.length
      : 97.5;
  }

  // ─── Daily metrics (now demand-driven) ───────────────────────────────────

  private buildDailyMetrics(dailyCapEx: number): DailyMetrics {
    const activeEvents = this.state.maintenanceEvents.filter(e => e.active);
    const otpHit = activeEvents.reduce((s, e) => s + e.otpImpactPct, 0);
    const otpNoise = (Math.random() - 0.5) * 2 * 0.01; // ±1%
    const onTimePerformancePct = Math.max(92, Math.min(99.5, 97.5 + otpNoise * 100 + otpHit));

    // Demand: generated bottom-up from gravity + coverage + OTP
    const demand = this.buildDemand();
    const totalPassengers = demand.servedTrips;

    // Revenue: served trips × fare
    // Fare varies by trip type and route length; use weighted avg per served route
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    const avgTicketPrice = opRoutes.length > 0
      ? opRoutes.reduce((s, r) => s + r.distanceKm * 0.10, 0) / opRoutes.length
      : 22;
    const totalRevenue = totalPassengers * avgTicketPrice;

    // OpEx: energy + staffing + maintenance — scales with fleet and routes
    const annualOpex = 650_000_000
      + this.state.pods.length     * 65_000   // €65k/pod/year
      + opRoutes.length            * 8_000_000; // €8M/route/year
    const totalOpex = annualOpex / 365;

    // Utilisation: pods are now dispatched proportional to demand
    const travelingPods = this.state.pods.filter(p => p.status === 'traveling').length;
    const utilizationPct = this.state.pods.length > 0
      ? (travelingPods / this.state.pods.length) * 100 : 0;

    // Trip split and modal chains
    const tripSplit = this.tripSplit(opRoutes, totalPassengers);
    const modalChains = this.modalChains(tripSplit);

    const avgDistanceKm = 220; // weighted average across network
    const revPerPaxKm = totalPassengers > 0 ? totalRevenue / (totalPassengers * avgDistanceKm) : 0;

    return {
      date: new Date(this.state.currentDate),
      totalPassengers,
      totalRevenueEur: totalRevenue,
      totalOperatingCostEur: totalOpex,
      podUtilizationPercent: utilizationPct,
      routeOperationalPercent: opRoutes.length / Math.max(this.state.routes.length, 1) * 100,
      averageTicketPriceEur: avgTicketPrice,
      onTimePerformancePct,
      tripsByType: tripSplit,
      modalChains,
      demand,
      demandBoostFromMaintenancePct: activeEvents.reduce((s, e) => s + e.demandBoostPct, 0),
      activeMaintenanceCount: activeEvents.length,
      revenuePerPassengerKm: revPerPaxKm,
      dailyCapEx,
    };
  }

  // ─── Pod dispatch (demand-driven) ─────────────────────────────────────────
  // Pod states now reflect where demand is, not random noise.

  private updatePodStates(totalServed: number): void {
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    const pausedIds = new Set(this.state.routes.filter(r => r.statusCode === 'paused').map(r => r.id));

    // Compute demand weight per route to guide pod utilisation
    const routeWeight: Record<string, number> = {};
    const cityCount = this.state.cities.length;
    opRoutes.forEach(r => {
      const from = this.state.cities.find(c => c.id === r.fromCityId)!;
      const to   = this.state.cities.find(c => c.id === r.toCityId)!;
      const w = Math.sqrt(from.population * to.population) / r.distanceKm;
      routeWeight[r.id] = w;
    });
    const totalWeight = Object.values(routeWeight).reduce((a, b) => a + b, 0) || 1;

    this.state.pods.forEach(pod => {
      if (pausedIds.has(pod.routeId)) { pod.status = 'maintenance'; return; }
      const route = this.state.routes.find(r => r.id === pod.routeId);
      if (!route || route.statusCode !== 'operational') return;

      // Probability of being in 'traveling' scales with route's demand share
      const demandShare = (routeWeight[route.id] ?? 0) / totalWeight;
      const travelProb = Math.min(0.60, 0.20 + demandShare * cityCount * 0.8);

      const r = Math.random();
      if (r < travelProb) {
        pod.status = 'traveling';
        pod.currentPassengers = Math.min(pod.capacity, 1 + Math.floor(Math.random() * pod.capacity));
        pod.distanceTraveledKm += route.distanceKm / (route.estimatedMinutes / 60);
        pod.totalRevenueEur    += pod.currentPassengers * route.distanceKm * 0.10;
      } else if (r < travelProb + 0.35) {
        pod.status = 'at_hub';
        pod.currentPassengers = 0;
        pod.batteryPercentage = Math.min(100, pod.batteryPercentage + 8);
      } else {
        pod.status = 'idle';
        pod.currentPassengers = 0;
      }
    });
  }

  // ─── Trip mix & modal chains ───────────────────────────────────────────────

  private tripSplit(routes: Route[], total: number): TripTypeSplit {
    let cw = 0, bw = 0, vw = 0;
    routes.forEach(r => {
      const d = r.distanceKm;
      if      (d <  100) { cw += 0.70; bw += 0.25; vw += 0.05; }
      else if (d <  300) { cw += 0.20; bw += 0.60; vw += 0.20; }
      else if (d <  500) { cw += 0.10; bw += 0.50; vw += 0.40; }
      else               { cw += 0.05; bw += 0.35; vw += 0.60; }
    });
    const t = cw + bw + vw || 1;
    return { commute: Math.round(total * cw / t), business: Math.round(total * bw / t), vacation: Math.round(total * vw / t) };
  }

  private modalChains(split: TripTypeSplit): ModalChainEntry[] {
    const entries: ModalChainEntry[] = [];
    const add = (templates: typeof COMMUTE_CHAINS, n: number, type: TripType) =>
      templates.forEach(t => entries.push({ chain: t.chain.join(' → '), tripCount: Math.round(n * t.w), avgDistanceKm: t.km, tripType: type }));
    add(COMMUTE_CHAINS,  split.commute,  'commute');
    add(BUSINESS_CHAINS, split.business, 'business');
    add(VACATION_CHAINS, split.vacation, 'vacation');
    return entries;
  }

  // ─── Regional metrics ──────────────────────────────────────────────────────

  private computeRegional(daily: DailyMetrics): RegionalSnapshot[] {
    return this.state.regions.map(region => {
      const citySet = new Set(region.cityIds);
      const rRoutes = this.state.routes.filter(r =>
        r.statusCode === 'operational' && (citySet.has(r.fromCityId) || citySet.has(r.toCityId))
      );
      const rPods = this.state.pods.filter(p => rRoutes.some(r => r.id === p.routeId));
      const frac  = rRoutes.length / Math.max(this.state.routes.filter(r => r.statusCode === 'operational').length, 1);

      const pax = Math.round(daily.totalPassengers * frac);
      const split = this.tripSplit(rRoutes, pax);
      const dominant: TripType = split.commute > split.business && split.commute > split.vacation ? 'commute'
        : split.business > split.vacation ? 'business' : 'vacation';

      const avgDist =
        (split.commute / Math.max(pax, 1)) * region.avgCommuteDistanceKm +
        (split.business / Math.max(pax, 1)) * region.avgBusinessDistanceKm +
        (split.vacation / Math.max(pax, 1)) * region.avgVacationDistanceKm;

      const regionalOtpNoise = (Math.random() - 0.5) * 2 * 0.005;
      const otp = Math.max(92, Math.min(99.5, daily.onTimePerformancePct + regionalOtpNoise * 100));

      const regionCovAvg = region.cityIds.reduce((s, cid) => s + (this.state.coverageByCity[cid] ?? 0), 0) / region.cityIds.length;

      return {
        regionId: region.id, regionName: region.name,
        totalDailyPassengers: pax,
        avgTripDistanceKm: Math.round(avgDist),
        onTimePerformancePct: Math.round(otp * 10) / 10,
        dominantTripType: dominant,
        activePods: rPods.filter(p => p.status === 'traveling').length,
        operationalRoutes: rRoutes.length,
        revenueEur: daily.totalRevenueEur * frac,
        coverage: Math.round(regionCovAvg * 1000) / 1000,
      };
    });
  }

  // ─── Financial metrics ────────────────────────────────────────────────────

  public getFinancialMetrics() {
    const recent = this.state.dailyMetrics.slice(-365);
    if (recent.length === 0) return this.emptyMetrics();

    const avgRevenue   = recent.reduce((s, m) => s + m.totalRevenueEur,        0) / recent.length;
    const avgOpex      = recent.reduce((s, m) => s + m.totalOperatingCostEur,  0) / recent.length;
    const avgCapEx     = recent.reduce((s, m) => s + m.dailyCapEx,             0) / recent.length;
    const profitMargin = avgRevenue > 0 ? (avgRevenue - avgOpex) / avgRevenue * 100 : null;
    const avgOtp       = recent.reduce((s, m) => s + m.onTimePerformancePct,   0) / recent.length;
    const avgRevPKm    = recent.reduce((s, m) => s + m.revenuePerPassengerKm,  0) / recent.length;

    // Seasonal demand index: rolling 7-day vs 90-day baseline
    const r7  = this.state.dailyMetrics.slice(-7);
    const r90 = this.state.dailyMetrics.slice(-90);
    const seasonal = r90.length > 0
      ? (r7.reduce((s, m) => s + m.totalPassengers, 0) / Math.max(r7.length, 1)) /
        (r90.reduce((s, m) => s + m.totalPassengers, 0) / r90.length) : null;

    // Network reach
    const opCities = new Set(
      this.state.routes.filter(r => r.statusCode === 'operational').flatMap(r => [r.fromCityId, r.toCityId])
    );
    const networkReachPct = opCities.size / this.state.cities.length * 100;

    // Break-even per route
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational').length;
    const dailyProfitPerRoute = (avgRevenue - avgOpex) / Math.max(opRoutes, 1);
    const breakEvenDays = dailyProfitPerRoute > 0 ? 800_000_000 / dailyProfitPerRoute : null;

    // CapEx breakdown by category (last 365 days)
    const capexByCategory: Record<string, number> = {};
    this.state.capexLog.forEach(r => {
      capexByCategory[r.category] = (capexByCategory[r.category] || 0) + r.amountEur;
    });

    // Demand metrics
    const lastDemand = this.state.dailyMetrics.slice(-1)[0]?.demand;
    const avgFulfillment = recent.reduce((s, m) => s + (m.demand?.fulfillmentRate ?? 0), 0) / recent.length;

    return {
      annualProjection:         avgRevenue * 365,
      avgDailyRevenue:          avgRevenue,
      avgDailyOpex:             avgOpex,
      avgDailyCapEx:            avgCapEx,
      profitMargin,
      ebitda:                   (avgRevenue - avgOpex) * 365,
      cumulativeRevenue:        this.state.cumulativeRevenue,
      cumulativeOpex:           this.state.cumulativeOpex,
      cumulativeCapEx:          this.state.cumulativeCapEx,
      netProfitYtd:             this.state.cumulativeRevenue - this.state.cumulativeOpex,
      totalInvestment:          this.state.cumulativeCapEx,
      roi:                      this.state.cumulativeCapEx > 0
                                  ? (this.state.cumulativeRevenue - this.state.cumulativeOpex - (this.state.cumulativeCapEx - PODSSimulationEngine.HISTORICAL_CAPEX_EUR)) / this.state.cumulativeCapEx * 100
                                  : null,
      avgOnTimePerformancePct:  Math.round(avgOtp * 10) / 10,
      avgRevenuePerPassengerKm: Math.round(avgRevPKm * 100) / 100,
      seasonalDemandIndex:      seasonal ? Math.round(seasonal * 100) / 100 : null,
      networkReachPct:          Math.round(networkReachPct),
      breakEvenDays:            breakEvenDays ? Math.round(breakEvenDays) : null,
      capexByCategory,
      latestDemand:             lastDemand,
      avgFulfillmentRate:       Math.round(avgFulfillment * 1000) / 1000,
    };
  }

  private emptyMetrics() {
    return {
      annualProjection: null, avgDailyRevenue: null, avgDailyOpex: null, avgDailyCapEx: null,
      profitMargin: null, ebitda: null, cumulativeRevenue: 0, cumulativeOpex: 0,
      cumulativeCapEx: this.state.cumulativeCapEx, netProfitYtd: 0, totalInvestment: this.state.cumulativeCapEx,
      roi: null, avgOnTimePerformancePct: null, avgRevenuePerPassengerKm: null,
      seasonalDemandIndex: null, networkReachPct: 0, breakEvenDays: null, capexByCategory: {},
      latestDemand: null, avgFulfillmentRate: 0,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public start(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      for (let i = 0; i < this.simulationSpeed; i++) this.tick();
    }, this.dayDurationMs);
  }

  public stop(): void {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
  }

  public setSpeed(s: number): void { this.simulationSpeed = Math.max(1, Math.min(365, s)); }
  public getState(): SimulationState { return { ...this.state }; }

  public addRoute(from: string, to: string, maglev = false): Route {
    const a = this.state.cities.find(c => c.id === from)!;
    const b = this.state.cities.find(c => c.id === to)!;
    if (!a || !b) throw new Error('Invalid city IDs');
    const dist = this.haversine(a.lat, a.lng, b.lat, b.lng);
    const type: RouteType = a.regionId !== b.regionId ? 'cross_border' : dist < 200 ? 'regional' : 'intercity';
    const r: Route = {
      id: uuidv4(), fromCityId: from, toCityId: to, distanceKm: dist, maglev,
      estimatedMinutes: Math.round(dist / (maglev ? 450 : 120) * 60),
      capsuleCapacity: 4, statusCode: 'planning', routeType: type,
    };
    this.state.routes.push(r);
    return r;
  }

  public operationalizeRoute(id: string): void {
    const r = this.state.routes.find(r => r.id === id);
    if (!r) throw new Error('Route not found');
    r.statusCode = 'operational';
    r.operationalSince = new Date(this.state.currentDate);
  }

  public subscribe(cb: (s: SimulationState) => void): () => void {
    this.subscribers.push(cb);
    return () => { this.subscribers = this.subscribers.filter(s => s !== cb); };
  }

  private notifySubscribers(): void {
    const s = this.getState();
    this.subscribers.forEach(cb => cb(s));
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371, dl = (lat2 - lat1) * Math.PI / 180, dL = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dl/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dL/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

export default PODSSimulationEngine;
