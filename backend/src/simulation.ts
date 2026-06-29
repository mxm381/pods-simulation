import { v4 as uuidv4 } from 'uuid';

// ─── Enums & scalars ──────────────────────────────────────────────────────────

export type TripType      = 'commute' | 'business' | 'vacation';
export type TransportMode = 'walk' | 'e_scooter' | 'e_bike' | 'local_pod' | 'regional_pod' | 'intercity_pod' | 'maglev';
export type RouteType     = 'local' | 'regional' | 'intercity' | 'cross_border';
export type MaintType     = 'planned_road' | 'planned_rail' | 'planned_pods' | 'unplanned_pods';
export type CapExCategory = 'r_and_d' | 'route_construction' | 'hub_construction' | 'fleet_acquisition' | 'local_network' | 'technology';

// ─── Real-world European city candidate pool ──────────────────────────────────
// Cities are NOT hardcoded to be added — the algorithm selects from this pool
// based on live simulation state: demand gaps, coverage holes, corridor bridging.

export interface CandidateCity {
  id: string; name: string; country: string;
  lat: number; lng: number; population: number;
  demandMultiplier: number; regionId: string; isHub: boolean;
}

const EU_CANDIDATE_POOL: CandidateCity[] = [
  // Germany
  { id: 'munich_ext',    name: 'Nuremberg',    country: 'DE', lat: 49.452, lng: 11.077, population:  520_000, demandMultiplier: 1.05, regionId: 'bavaria',    isHub: false },
  { id: 'mannheim',      name: 'Mannheim',     country: 'DE', lat: 49.488, lng: 8.466,  population:  310_000, demandMultiplier: 1.00, regionId: 'southwest',  isHub: false },
  { id: 'hannover',      name: 'Hannover',     country: 'DE', lat: 52.375, lng: 9.735,  population:  535_000, demandMultiplier: 1.00, regionId: 'north',      isHub: false },
  { id: 'dortmund',      name: 'Dortmund',     country: 'DE', lat: 51.514, lng: 7.468,  population:  590_000, demandMultiplier: 1.00, regionId: 'rhine_ruhr', isHub: false },
  { id: 'essen',         name: 'Essen',        country: 'DE', lat: 51.457, lng: 7.012,  population:  580_000, demandMultiplier: 0.98, regionId: 'rhine_ruhr', isHub: false },
  { id: 'leipzig',       name: 'Leipzig',      country: 'DE', lat: 51.340, lng: 12.375, population:  600_000, demandMultiplier: 1.02, regionId: 'berlin',     isHub: false },
  { id: 'dresden',       name: 'Dresden',      country: 'DE', lat: 51.050, lng: 13.738, population:  554_000, demandMultiplier: 1.02, regionId: 'east_central', isHub: false },
  { id: 'freiburg',      name: 'Freiburg',     country: 'DE', lat: 47.999, lng: 7.842,  population:  230_000, demandMultiplier: 1.05, regionId: 'southwest',  isHub: false },
  { id: 'karlsruhe',     name: 'Karlsruhe',    country: 'DE', lat: 49.006, lng: 8.403,  population:  310_000, demandMultiplier: 1.00, regionId: 'southwest',  isHub: false },
  // Netherlands / Belgium
  { id: 'rotterdam',     name: 'Rotterdam',    country: 'NL', lat: 51.924, lng: 4.477,  population:  651_000, demandMultiplier: 1.15, regionId: 'rhine_ruhr', isHub: false },
  { id: 'the_hague',     name: 'The Hague',    country: 'NL', lat: 52.070, lng: 4.300,  population:  548_000, demandMultiplier: 1.10, regionId: 'rhine_ruhr', isHub: false },
  { id: 'antwerp',       name: 'Antwerp',      country: 'BE', lat: 51.221, lng: 4.400,  population:  530_000, demandMultiplier: 1.10, regionId: 'rhine_ruhr', isHub: false },
  { id: 'ghent',         name: 'Ghent',        country: 'BE', lat: 51.054, lng: 3.717,  population:  260_000, demandMultiplier: 1.05, regionId: 'rhine_ruhr', isHub: false },
  // France
  { id: 'marseille',     name: 'Marseille',    country: 'FR', lat: 43.296, lng: 5.370,  population:  870_000, demandMultiplier: 1.10, regionId: 'paris',      isHub: false },
  { id: 'toulouse',      name: 'Toulouse',     country: 'FR', lat: 43.605, lng: 1.444,  population:  480_000, demandMultiplier: 1.05, regionId: 'paris',      isHub: false },
  { id: 'nice',          name: 'Nice',         country: 'FR', lat: 43.710, lng: 7.262,  population:  340_000, demandMultiplier: 1.20, regionId: 'paris',      isHub: false },
  { id: 'bordeaux',      name: 'Bordeaux',     country: 'FR', lat: 44.837, lng: -0.579, population:  260_000, demandMultiplier: 1.10, regionId: 'paris',      isHub: false },
  { id: 'strasbourg',    name: 'Strasbourg',   country: 'FR', lat: 48.573, lng: 7.752,  population:  285_000, demandMultiplier: 1.10, regionId: 'southwest',  isHub: false },
  { id: 'nantes',        name: 'Nantes',       country: 'FR', lat: 47.218, lng: -1.554, population:  310_000, demandMultiplier: 1.05, regionId: 'paris',      isHub: false },
  { id: 'lille',         name: 'Lille',        country: 'FR', lat: 50.630, lng: 3.070,  population:  235_000, demandMultiplier: 1.08, regionId: 'rhine_ruhr', isHub: false },
  // Austria / Switzerland
  { id: 'salzburg',      name: 'Salzburg',     country: 'AT', lat: 47.804, lng: 13.045, population:  155_000, demandMultiplier: 1.30, regionId: 'bavaria',    isHub: false },
  { id: 'graz',          name: 'Graz',         country: 'AT', lat: 47.070, lng: 15.440, population:  290_000, demandMultiplier: 1.05, regionId: 'bavaria',    isHub: false },
  { id: 'lausanne',      name: 'Lausanne',     country: 'CH', lat: 46.516, lng: 6.633,  population:  140_000, demandMultiplier: 1.35, regionId: 'bavaria',    isHub: false },
  { id: 'bern',          name: 'Bern',         country: 'CH', lat: 46.948, lng: 7.447,  population:  135_000, demandMultiplier: 1.25, regionId: 'bavaria',    isHub: false },
  // Scandinavia / Baltic
  { id: 'oslo',          name: 'Oslo',         country: 'NO', lat: 59.913, lng: 10.752, population:  700_000, demandMultiplier: 1.20, regionId: 'north',      isHub: false },
  { id: 'stockholm',     name: 'Stockholm',    country: 'SE', lat: 59.333, lng: 18.065, population:  980_000, demandMultiplier: 1.20, regionId: 'north',      isHub: false },
  { id: 'gothenburg',    name: 'Gothenburg',   country: 'SE', lat: 57.708, lng: 11.975, population:  580_000, demandMultiplier: 1.10, regionId: 'north',      isHub: false },
  { id: 'malmo',         name: 'Malmö',        country: 'SE', lat: 55.605, lng: 13.001, population:  350_000, demandMultiplier: 1.05, regionId: 'north',      isHub: false },
  // Italy
  { id: 'milan',         name: 'Milan',        country: 'IT', lat: 45.464, lng: 9.190,  population: 1_370_000, demandMultiplier: 1.25, regionId: 'bavaria',   isHub: true },
  { id: 'rome',          name: 'Rome',         country: 'IT', lat: 41.902, lng: 12.496, population: 2_870_000, demandMultiplier: 1.15, regionId: 'bavaria',   isHub: false },
  { id: 'turin',         name: 'Turin',        country: 'IT', lat: 45.070, lng: 7.686,  population:  880_000, demandMultiplier: 1.10, regionId: 'bavaria',    isHub: false },
  { id: 'florence',      name: 'Florence',     country: 'IT', lat: 43.769, lng: 11.256, population:  380_000, demandMultiplier: 1.20, regionId: 'bavaria',    isHub: false },
  { id: 'venice',        name: 'Venice',       country: 'IT', lat: 45.440, lng: 12.335, population:  260_000, demandMultiplier: 1.30, regionId: 'bavaria',    isHub: false },
  { id: 'bologna',       name: 'Bologna',      country: 'IT', lat: 44.494, lng: 11.342, population:  400_000, demandMultiplier: 1.10, regionId: 'bavaria',    isHub: false },
  // Spain
  { id: 'barcelona',     name: 'Barcelona',    country: 'ES', lat: 41.386, lng: 2.170,  population: 1_636_000, demandMultiplier: 1.20, regionId: 'paris',    isHub: true },
  { id: 'madrid',        name: 'Madrid',       country: 'ES', lat: 40.416, lng: -3.703, population: 3_300_000, demandMultiplier: 1.15, regionId: 'paris',    isHub: true },
  // Eastern Europe
  { id: 'budapest',      name: 'Budapest',     country: 'HU', lat: 47.498, lng: 19.040, population: 1_750_000, demandMultiplier: 1.05, regionId: 'east_central', isHub: false },
  { id: 'bratislava',    name: 'Bratislava',   country: 'SK', lat: 48.148, lng: 17.107, population:  480_000, demandMultiplier: 1.00, regionId: 'east_central', isHub: false },
  { id: 'krakow',        name: 'Kraków',       country: 'PL', lat: 50.062, lng: 19.944, population:  774_000, demandMultiplier: 1.05, regionId: 'east_central', isHub: false },
  { id: 'wroclaw',       name: 'Wrocław',      country: 'PL', lat: 51.108, lng: 17.038, population:  640_000, demandMultiplier: 1.00, regionId: 'east_central', isHub: false },
  { id: 'gdansk',        name: 'Gdańsk',       country: 'PL', lat: 54.352, lng: 18.646, population:  470_000, demandMultiplier: 1.00, regionId: 'north',      isHub: false },
  { id: 'vilnius',       name: 'Vilnius',      country: 'LT', lat: 54.687, lng: 25.280, population:  580_000, demandMultiplier: 1.00, regionId: 'east_central', isHub: false },
  { id: 'riga',          name: 'Riga',         country: 'LV', lat: 56.946, lng: 24.105, population:  630_000, demandMultiplier: 1.00, regionId: 'north',      isHub: false },
  // UK
  { id: 'london',        name: 'London',       country: 'GB', lat: 51.509, lng: -0.118, population: 9_540_000, demandMultiplier: 1.40, regionId: 'rhine_ruhr', isHub: true },
  { id: 'manchester',    name: 'Manchester',   country: 'GB', lat: 53.481, lng: -2.243, population: 2_730_000, demandMultiplier: 1.10, regionId: 'north',      isHub: false },
];

// ─── Innercity sub-network types ──────────────────────────────────────────────

export type InnercityMode = 's_bahn' | 'u_bahn' | 'tram' | 'gondola' | 'local_pod_dense';

export interface InnercityLine {
  cityId: string; mode: InnercityMode;
  name: string; coverageRadiusKm: number; dailyCapacity: number;
  operational: boolean; openDay: number; investmentEur: number;
}

export interface InnercityNetwork {
  cityId: string; lines: InnercityLine[];
  combinedCoverage: number; // 0-1
  dailyLocalTrips: number;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface City {
  id: string; name: string; lat: number; lng: number;
  population: number; demandMultiplier: number; regionId: string;
  isHub: boolean;
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

export interface CityPairDemand {
  fromId: string; toId: string;
  potentialTrips: number;
  podsCapture: number;
  servedTrips: number;
  travelTimeMinutes: number;
  carTimeMinutes: number;
  planeTimeMinutes: number | null;
  competitorChoice: 'pods_wins' | 'car_competitive' | 'plane_wins' | 'pods_best';
  hops: string[];
}

export interface DemandSnapshot {
  potentialTrips: number;
  servedTrips: number;
  fulfillmentRate: number;
  unservedDueToCoverage: number;
  unservedDueToCapacity: number;
  unservedDueToCompetition: number;
  avgCoverage: number;
  coverageByCity: Record<string, number>;
  topPairs: CityPairDemand[];
}

export interface ModalChainEntry {
  chain: string; tripCount: number; avgDistanceKm: number; tripType: TripType;
}

export interface TripTypeSplit { commute: number; business: number; vacation: number; }

export interface DailyMetrics {
  date: Date;
  totalPassengers: number;
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

export interface CityExpansionRecommendation {
  candidate: CandidateCity;
  score: number;
  reason: string;
  estimatedDailyDemandGain: number;
  bridgesCorridors: string[]; // describes which existing routes it improves
  suggestedRoutes: { toCity: string; timeSavingPct: number }[];
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
  innercityNetworks: InnercityNetwork[];
  expansionRecommendations: CityExpansionRecommendation[];
}

// ─── Modal chain templates ────────────────────────────────────────────────────

const COMMUTE_CHAINS = [
  { chain: ['walk', 'local_pod', 'walk']             as TransportMode[], w: 0.35, km: 12 },
  { chain: ['e_bike', 'local_pod', 'walk']           as TransportMode[], w: 0.25, km: 18 },
  { chain: ['e_scooter', 'local_pod', 'e_scooter']  as TransportMode[], w: 0.20, km: 14 },
  { chain: ['e_bike', 'regional_pod', 'walk']        as TransportMode[], w: 0.20, km: 35 },
];
const BUSINESS_CHAINS = [
  { chain: ['walk', 'local_pod', 'intercity_pod', 'walk']                        as TransportMode[], w: 0.30, km: 280 },
  { chain: ['e_scooter', 'regional_pod', 'maglev', 'e_scooter']                  as TransportMode[], w: 0.25, km: 380 },
  { chain: ['walk', 'intercity_pod', 'walk']                                      as TransportMode[], w: 0.20, km: 220 },
  { chain: ['e_bike', 'local_pod', 'maglev', 'local_pod', 'e_scooter']           as TransportMode[], w: 0.25, km: 450 },
];
const VACATION_CHAINS = [
  { chain: ['walk', 'local_pod', 'maglev', 'local_pod', 'walk']                  as TransportMode[], w: 0.40, km: 480 },
  { chain: ['e_bike', 'regional_pod', 'maglev', 'regional_pod', 'e_bike']        as TransportMode[], w: 0.30, km: 550 },
  { chain: ['walk', 'local_pod', 'intercity_pod', 'local_pod', 'walk']           as TransportMode[], w: 0.30, km: 320 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function poisson(lambda: number): boolean { return Math.random() < 1 - Math.exp(-lambda); }

// ─── Engine ───────────────────────────────────────────────────────────────────

export class PODSSimulationEngine {
  private state: SimulationState;
  private dayDurationMs = 1000;
  private tickInterval: NodeJS.Timeout | null = null;
  private simulationSpeed = 1;
  private subscribers: ((s: SimulationState) => void)[] = [];

  private static readonly HISTORICAL_CAPEX_EUR = 17_800_000_000;

  constructor() {
    this.state = {
      simulationDay: 0, currentDate: new Date('2035-01-01'),
      cities: [], routes: [], pods: [],
      dailyMetrics: [], cumulativeRevenue: 0, cumulativeOpex: 0,
      regions: [], maintenanceEvents: [], latestRegionalMetrics: [],
      coverageByCity: {}, capexLog: [],
      cumulativeCapEx: PODSSimulationEngine.HISTORICAL_CAPEX_EUR,
      innercityNetworks: [],
      expansionRecommendations: [],
    };
    this.initNetwork();
    this.initInnercityNetworks();
    this.seedMaintenance();
    this.state.expansionRecommendations = this.computeExpansionRecommendations();
  }

  // ─── Network initialisation ────────────────────────────────────────────────

  private initNetwork(): void {
    this.state.regions = [
      { id: 'berlin',       name: 'Berlin Capital Region',  cityIds: ['berlin'],                                         characterType: 'business_hub',    avgCommuteDistanceKm: 22, avgBusinessDistanceKm: 340, avgVacationDistanceKm: 520 },
      { id: 'north',        name: 'Northern Germany',        cityIds: ['hamburg', 'copenhagen'],                          characterType: 'transit_corridor', avgCommuteDistanceKm: 18, avgBusinessDistanceKm: 290, avgVacationDistanceKm: 480 },
      { id: 'rhine_ruhr',   name: 'Rhine-Ruhr Metropolis',  cityIds: ['cologne', 'dusseldorf', 'amsterdam', 'brussels'], characterType: 'urban_dense',      avgCommuteDistanceKm: 15, avgBusinessDistanceKm: 180, avgVacationDistanceKm: 420 },
      { id: 'southwest',    name: 'Southwest Germany',       cityIds: ['frankfurt', 'stuttgart'],                         characterType: 'business_hub',    avgCommuteDistanceKm: 25, avgBusinessDistanceKm: 380, avgVacationDistanceKm: 560 },
      { id: 'bavaria',      name: 'Bavaria & Alps',          cityIds: ['munich', 'vienna', 'zurich', 'basel', 'geneva'],  characterType: 'tourism',         avgCommuteDistanceKm: 20, avgBusinessDistanceKm: 310, avgVacationDistanceKm: 620 },
      { id: 'paris',        name: 'Greater Paris Region',    cityIds: ['paris', 'lyon'],                                  characterType: 'business_hub',    avgCommuteDistanceKm: 28, avgBusinessDistanceKm: 420, avgVacationDistanceKm: 680 },
      { id: 'east_central', name: 'East-Central Europe',     cityIds: ['prague', 'warsaw'],                               characterType: 'transit_corridor', avgCommuteDistanceKm: 20, avgBusinessDistanceKm: 360, avgVacationDistanceKm: 580 },
    ];

    this.state.cities = [
      { id: 'berlin',     name: 'Berlin',     lat: 52.520, lng: 13.405, population: 3_645_000, demandMultiplier: 1.20, regionId: 'berlin',       isHub: true },
      { id: 'munich',     name: 'Munich',     lat: 48.135, lng: 11.582, population: 1_471_000, demandMultiplier: 1.15, regionId: 'bavaria',      isHub: true },
      { id: 'frankfurt',  name: 'Frankfurt',  lat: 50.111, lng: 8.682,  population:   746_000, demandMultiplier: 1.35, regionId: 'southwest',    isHub: true },
      { id: 'hamburg',    name: 'Hamburg',    lat: 53.551, lng: 9.993,  population: 1_841_000, demandMultiplier: 1.10, regionId: 'north',        isHub: true },
      { id: 'cologne',    name: 'Cologne',    lat: 50.937, lng: 6.959,  population: 1_085_000, demandMultiplier: 1.05, regionId: 'rhine_ruhr',   isHub: false },
      { id: 'amsterdam',  name: 'Amsterdam',  lat: 52.368, lng: 4.904,  population:   873_000, demandMultiplier: 1.25, regionId: 'rhine_ruhr',   isHub: true },
      { id: 'paris',      name: 'Paris',      lat: 48.857, lng: 2.352,  population: 2_161_000, demandMultiplier: 1.30, regionId: 'paris',        isHub: true },
      { id: 'vienna',     name: 'Vienna',     lat: 48.208, lng: 16.374, population: 1_920_000, demandMultiplier: 1.15, regionId: 'bavaria',      isHub: true },
      { id: 'zurich',     name: 'Zurich',     lat: 47.377, lng: 8.547,  population:   400_000, demandMultiplier: 1.40, regionId: 'bavaria',      isHub: true },
      { id: 'brussels',   name: 'Brussels',   lat: 50.850, lng: 4.352,  population: 1_210_000, demandMultiplier: 1.20, regionId: 'rhine_ruhr',   isHub: false },
      { id: 'stuttgart',  name: 'Stuttgart',  lat: 48.775, lng: 9.182,  population:   635_000, demandMultiplier: 1.10, regionId: 'southwest',    isHub: false },
      { id: 'dusseldorf', name: 'Düsseldorf', lat: 51.225, lng: 6.782,  population:   620_000, demandMultiplier: 1.10, regionId: 'rhine_ruhr',   isHub: false },
      { id: 'basel',      name: 'Basel',      lat: 47.560, lng: 7.589,  population:   180_000, demandMultiplier: 1.20, regionId: 'bavaria',      isHub: false },
      { id: 'geneva',     name: 'Geneva',     lat: 46.204, lng: 6.143,  population:   200_000, demandMultiplier: 1.30, regionId: 'bavaria',      isHub: false },
      { id: 'copenhagen', name: 'Copenhagen', lat: 55.676, lng: 12.568, population:   810_000, demandMultiplier: 1.15, regionId: 'north',        isHub: false },
      { id: 'lyon',       name: 'Lyon',       lat: 45.750, lng: 4.846,  population:   515_000, demandMultiplier: 1.10, regionId: 'paris',        isHub: false },
      { id: 'prague',     name: 'Prague',     lat: 50.088, lng: 14.420, population: 1_330_000, demandMultiplier: 1.05, regionId: 'east_central', isHub: false },
      { id: 'warsaw',     name: 'Warsaw',     lat: 52.230, lng: 21.012, population: 1_800_000, demandMultiplier: 1.00, regionId: 'east_central', isHub: false },
    ];

    const mkRoute = (id: string, f: string, t: string, km: number, maglev: boolean, mins: number,
                     status: Route['statusCode'], type: RouteType, openDay?: number): Route => ({
      id, fromCityId: f, toCityId: t, distanceKm: km, maglev, estimatedMinutes: mins,
      capsuleCapacity: 4, statusCode: status,
      operationalSince: status === 'operational' ? new Date('2034-01-01') : undefined,
      estimatedOpenDay: openDay, routeType: type,
    });

    // Route design principle: spine network only. No redundant direct routes where
    // a 1-hop path is nearly as fast. New direct routes only when they save ≥20% time.
    this.state.routes = [
      // ── Core maglev spine (operational) ────────────────────────────────────
      mkRoute('r1',  'berlin',    'hamburg',    290, true,  38, 'operational', 'intercity'),
      mkRoute('r2',  'berlin',    'frankfurt',  551, true,  73, 'operational', 'intercity'),
      mkRoute('r3',  'frankfurt', 'munich',     391, true,  52, 'operational', 'intercity'),
      mkRoute('r4',  'frankfurt', 'cologne',    190, true,  25, 'operational', 'regional'),
      mkRoute('r5',  'hamburg',   'amsterdam',  480, true,  64, 'operational', 'cross_border'),
      mkRoute('r6',  'frankfurt', 'paris',      586, true,  78, 'operational', 'cross_border'),
      mkRoute('r7',  'cologne',   'amsterdam',  220, true,  29, 'operational', 'cross_border'),
      mkRoute('r8',  'brussels',  'paris',      310, true,  41, 'operational', 'cross_border'),
      mkRoute('r9',  'frankfurt', 'zurich',     279, true,  37, 'operational', 'cross_border'),
      mkRoute('r10', 'munich',    'vienna',     400, true,  53, 'operational', 'cross_border'),
      mkRoute('r11', 'zurich',    'munich',     320, true,  43, 'operational', 'regional'),
      mkRoute('r12', 'berlin',    'vienna',     680, true,  91, 'operational', 'cross_border'),
      mkRoute('r13', 'brussels',  'amsterdam',  200, true,  27, 'operational', 'cross_border'),
      mkRoute('r14', 'paris',     'lyon',       465, true,  62, 'operational', 'regional'),
      mkRoute('r15', 'frankfurt', 'stuttgart',  210, true,  28, 'operational', 'regional'),
      // ── Standard fallback routes (operational) ─────────────────────────────
      mkRoute('r16', 'zurich',    'basel',       85, false,  42, 'operational', 'regional'),
      mkRoute('r17', 'zurich',    'geneva',     280, false, 140, 'operational', 'regional'),
      // ── Near-term construction ──────────────────────────────────────────────
      mkRoute('r18', 'paris',     'amsterdam',  510, true,  68, 'construction', 'cross_border', 60),
      mkRoute('r19', 'munich',    'prague',     370, true,  49, 'construction', 'cross_border', 90),
      mkRoute('r20', 'berlin',    'copenhagen', 430, true,  57, 'construction', 'cross_border', 120),
      mkRoute('r21', 'frankfurt', 'brussels',   280, true,  37, 'construction', 'cross_border', 80),
      // ── Planning ────────────────────────────────────────────────────────────
      mkRoute('r22', 'hamburg',   'copenhagen', 310, true,  41, 'planning', 'cross_border', 200),
      mkRoute('r23', 'vienna',    'prague',     310, true,  41, 'planning', 'cross_border', 240),
      mkRoute('r24', 'berlin',    'warsaw',     580, true,  77, 'planning', 'cross_border', 300),
      mkRoute('r25', 'lyon',      'geneva',     150, true,  20, 'planning', 'regional',     180),
      mkRoute('r26', 'dusseldorf','cologne',     45, false,  22, 'planning', 'local',        120),
      mkRoute('r27', 'stuttgart', 'munich',     230, true,  31, 'planning', 'regional',     270),
      mkRoute('r28', 'amsterdam', 'brussels',   200, true,  27, 'planning', 'cross_border', 150),
      mkRoute('r29', 'lyon',      'zurich',     300, true,  40, 'planning', 'cross_border', 320),
    ];

    // Coverage: hub cities 68%, non-hub connected 55%, unconnected 18%
    const opCities = new Set(
      this.state.routes.filter(r => r.statusCode === 'operational').flatMap(r => [r.fromCityId, r.toCityId])
    );
    this.state.cities.forEach(c => {
      if (!opCities.has(c.id))  this.state.coverageByCity[c.id] = 0.18;
      else if (c.isHub)         this.state.coverageByCity[c.id] = 0.68;
      else                      this.state.coverageByCity[c.id] = 0.55;
    });

    // Fleet: 4 200 pods across operational routes
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    for (let i = 0; i < 4200; i++) {
      const route = opRoutes[i % opRoutes.length];
      this.state.pods.push({
        id: `pod-${i}`, routeId: route.id,
        currentPassengers: Math.floor(Math.random() * 3), capacity: 4,
        status: (['idle','traveling','at_hub'] as const)[Math.floor(Math.random() * 3)],
        distanceTraveledKm: Math.random() * 50_000,
        totalRevenueEur: Math.random() * 500_000,
        batteryPercentage: 50 + Math.random() * 50,
      });
    }
  }

  // ─── Dijkstra shortest path ────────────────────────────────────────────────

  private bestPodsPath(fromId: string, toId: string): { minutes: number; hops: string[] } | null {
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    const adj: Record<string, { toId: string; minutes: number; routeId: string }[]> = {};
    opRoutes.forEach(r => {
      if (!adj[r.fromCityId]) adj[r.fromCityId] = [];
      if (!adj[r.toCityId])   adj[r.toCityId]   = [];
      adj[r.fromCityId].push({ toId: r.toCityId, minutes: r.estimatedMinutes, routeId: r.id });
      adj[r.toCityId].push({ toId: r.fromCityId, minutes: r.estimatedMinutes, routeId: r.id });
    });

    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const visited = new Set<string>();
    this.state.cities.forEach(c => { dist[c.id] = Infinity; prev[c.id] = null; });
    dist[fromId] = 0;

    const pq: [number, string][] = [[0, fromId]];
    let hopCount: Record<string, number> = { [fromId]: 0 };

    while (pq.length > 0) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, u] = pq.shift()!;
      if (visited.has(u)) continue;
      visited.add(u);
      if (u === toId) break;
      (adj[u] ?? []).forEach(({ toId: v, minutes }) => {
        const hops = hopCount[u] ?? 0;
        const penalty = hops > 0 ? 15 : 0; // 15 min transfer penalty per intermediate stop
        const newDist = d + minutes + penalty;
        if (newDist < dist[v]) {
          dist[v] = newDist; prev[v] = u;
          hopCount[v] = hops + 1;
          pq.push([newDist, v]);
        }
      });
    }

    if (dist[toId] === Infinity) return null;
    const hops: string[] = [];
    let cur: string | null = toId;
    while (cur !== null) { hops.unshift(cur); cur = prev[cur]; }
    return { minutes: dist[toId], hops };
  }

  // ─── Competition model ─────────────────────────────────────────────────────

  private captureRate(fromCity: City, toCity: City, podsMinutes: number | null, distKm: number): {
    capture: number;
    carMinutes: number;
    planeMinutes: number | null;
    competitorChoice: CityPairDemand['competitorChoice'];
  } {
    const carMinutes   = (distKm / 90) * 60 + 20;
    const planeMinutes = (distKm > 400 && fromCity.isHub && toCity.isHub)
      ? Math.round(distKm / 800 * 60) + 120
      : null;

    if (podsMinutes === null) {
      // No PODS network path — customer defaults to car/plane; small comfort-premium capture
      const covFactor = this.coverageFactor(fromCity.id, toCity.id);
      return { capture: 0.08 * covFactor, carMinutes, planeMinutes, competitorChoice: 'car_competitive' };
    }

    const podsWithOverhead = podsMinutes + 30;
    let capture: number;
    let competitorChoice: CityPairDemand['competitorChoice'];

    if (planeMinutes !== null && planeMinutes < podsWithOverhead * 0.80) {
      capture = 0.10 + 0.08 * Math.random();
      competitorChoice = 'plane_wins';
    } else if (podsWithOverhead < carMinutes * 0.75) {
      capture = 0.55 + 0.15 * Math.random();
      competitorChoice = 'pods_wins';
    } else if (podsWithOverhead < carMinutes) {
      capture = 0.35 + 0.10 * Math.random();
      competitorChoice = 'pods_best';
    } else {
      capture = 0.12 + 0.08 * Math.random();
      competitorChoice = 'car_competitive';
    }

    const covFactor = this.coverageFactor(fromCity.id, toCity.id);
    const otpFactor = this.otpToDemandFactor(this.recentAvgOtp());
    return { capture: capture * covFactor * otpFactor, carMinutes, planeMinutes, competitorChoice };
  }

  private coverageFactor(fromId: string, toId: string): number {
    const cov = Math.min(this.state.coverageByCity[fromId] ?? 0.2, this.state.coverageByCity[toId] ?? 0.2);
    if (cov < 0.20) return 0.05;
    if (cov < 0.50) return 0.05 + (cov - 0.20) / 0.30 * 0.45;
    if (cov < 0.80) return 0.50 + (cov - 0.50) / 0.30 * 0.40;
    return              0.90 + (cov - 0.80) / 0.20 * 0.09;
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
    return recent.length > 0 ? recent.reduce((s, m) => s + m.onTimePerformancePct, 0) / recent.length : 97.5;
  }

  // ─── Demand model: city-pair based ────────────────────────────────────────

  private buildDemand(): DemandSnapshot {
    const GRAVITY_K  = 0.45;
    const cities     = this.state.cities;
    const opRoutes   = this.state.routes.filter(r => r.statusCode === 'operational');
    const networkEff = Math.min(1.4, 1 + opRoutes.length / 30);
    const dayOfYear  = this.state.simulationDay % 365;
    const seasonal   = 1 + 0.08 * Math.sin((dayOfYear / 365) * 2 * Math.PI);
    const maintBoost = 1 + this.state.maintenanceEvents.filter(e => e.active)
      .reduce((s, e) => s + e.demandBoostPct, 0) / 100;

    // Route capacity pool (trips/day)
    const routeCapacity: Record<string, number> = {};
    opRoutes.forEach(r => {
      const pods = this.state.pods.filter(p => p.routeId === r.id && p.status !== 'maintenance').length;
      const tpd  = r.distanceKm < 200 ? 14 : r.distanceKm < 400 ? 8 : 5;
      routeCapacity[r.id] = pods * tpd * r.capsuleCapacity * 0.72;
    });
    const usedCapacity: Record<string, number> = {};

    let totalPotential = 0, totalServed = 0;
    let unservedCov = 0, unservedCap = 0, unservedComp = 0;
    const pairResults: CityPairDemand[] = [];

    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const a = cities[i], b = cities[j];
        const dist = this.haversine(a.lat, a.lng, b.lat, b.lng);
        if (dist < 40) continue;

        const potential = Math.round(
          GRAVITY_K * Math.sqrt(a.population * b.population) / dist
          * a.demandMultiplier * b.demandMultiplier * networkEff * seasonal * maintBoost * 2
        );
        totalPotential += potential;

        // Coverage loss (people who can't even access PODS locally)
        const covF   = this.coverageFactor(a.id, b.id);
        const covLoss = Math.round(potential * (1 - covF));
        unservedCov  += covLoss;

        const path = this.bestPodsPath(a.id, b.id);
        const { capture, carMinutes, planeMinutes, competitorChoice } =
          this.captureRate(a, b, path?.minutes ?? null, dist);

        const afterCapture = Math.round(potential * capture);
        unservedComp += Math.max(0, potential - covLoss - afterCapture);

        // Capacity allocation across path segments
        let served = afterCapture;
        if (path && path.hops.length > 1) {
          for (let h = 0; h < path.hops.length - 1; h++) {
            const sf = path.hops[h], st = path.hops[h + 1];
            const seg = opRoutes.find(r =>
              (r.fromCityId === sf && r.toCityId === st) ||
              (r.fromCityId === st && r.toCityId === sf)
            );
            if (!seg) { served = 0; break; }
            const cap = (routeCapacity[seg.id] ?? 0) - (usedCapacity[seg.id] ?? 0);
            served = Math.min(served, Math.max(0, cap));
          }
          if (served > 0) {
            for (let h = 0; h < path.hops.length - 1; h++) {
              const sf = path.hops[h], st = path.hops[h + 1];
              const seg = opRoutes.find(r =>
                (r.fromCityId === sf && r.toCityId === st) ||
                (r.fromCityId === st && r.toCityId === sf)
              );
              if (seg) usedCapacity[seg.id] = (usedCapacity[seg.id] ?? 0) + served;
            }
          }
        } else if (!path) {
          served = Math.round(afterCapture * 0.25); // local-pod only, minimal
        }

        unservedCap += Math.max(0, afterCapture - served);
        totalServed += served;

        pairResults.push({
          fromId: a.id, toId: b.id,
          potentialTrips: potential, podsCapture: capture, servedTrips: served,
          travelTimeMinutes: path?.minutes ?? Math.round(dist / 60 * 60),
          carTimeMinutes: carMinutes, planeTimeMinutes: planeMinutes,
          competitorChoice, hops: path?.hops ?? [a.id, b.id],
        });
      }
    }

    const covVals = Object.values(this.state.coverageByCity);
    const avgCov  = covVals.length > 0 ? covVals.reduce((a, b) => a + b, 0) / covVals.length : 0;
    const topPairs = [...pairResults].sort((a, b) => b.potentialTrips - a.potentialTrips).slice(0, 10);

    return {
      potentialTrips:           Math.round(totalPotential),
      servedTrips:              Math.round(totalServed),
      fulfillmentRate:          totalPotential > 0 ? Math.round(totalServed / totalPotential * 1000) / 1000 : 0,
      unservedDueToCoverage:    Math.round(unservedCov),
      unservedDueToCapacity:    Math.round(unservedCap),
      unservedDueToCompetition: Math.round(unservedComp),
      avgCoverage:              Math.round(avgCov * 1000) / 1000,
      coverageByCity:           { ...this.state.coverageByCity },
      topPairs,
    };
  }

  // ─── Maintenance ───────────────────────────────────────────────────────────

  private seedMaintenance(): void { this.scheduleMaintenance(0, 60); }

  private scheduleMaintenance(fromDay: number, toDay: number): void {
    const templates = [
      { type: 'planned_road'   as MaintType, sev: 'minor'    as const, days: 4,  boost:  8, otp:  0.0, desc: (r: string) => `Road resurfacing in ${r}` },
      { type: 'planned_road'   as MaintType, sev: 'moderate' as const, days: 7,  boost: 15, otp:  0.0, desc: (r: string) => `Bridge works in ${r}` },
      { type: 'planned_rail'   as MaintType, sev: 'moderate' as const, days: 5,  boost: 22, otp:  0.0, desc: (r: string) => `Track renewal near ${r}` },
      { type: 'planned_rail'   as MaintType, sev: 'major'    as const, days: 10, boost: 38, otp:  0.0, desc: (r: string) => `ICE corridor upgrade in ${r}` },
      { type: 'planned_pods'   as MaintType, sev: 'minor'    as const, days: 2,  boost: -5, otp: -0.4, desc: (r: string) => `Scheduled PODS hub maintenance in ${r}` },
      { type: 'unplanned_pods' as MaintType, sev: 'moderate' as const, days: 1,  boost:-10, otp: -0.9, desc: (r: string) => `Unplanned PODS track inspection in ${r}` },
    ];
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    let next = fromDay + 8 + Math.floor(Math.random() * 8);
    while (next < toDay) {
      const t      = pick(templates);
      const region = pick(this.state.regions);
      let routeId: string | undefined;
      if ((t.type === 'planned_pods' || t.type === 'unplanned_pods') && opRoutes.length > 0) {
        const reg = opRoutes.filter(r => region.cityIds.includes(r.fromCityId) || region.cityIds.includes(r.toCityId));
        routeId = pick(reg.length > 0 ? reg : opRoutes).id;
      }
      this.state.maintenanceEvents.push({
        id: uuidv4(), type: t.type, routeId, regionId: region.id,
        startDay: next, endDay: next + t.days, severity: t.sev,
        description: t.desc(region.name), demandBoostPct: t.boost, otpImpactPct: t.otp, active: false,
      });
      next += 12 + Math.floor(Math.random() * 13);
    }
  }

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

  // ─── City expansion: add top recommendation to live simulation ───────────

  private tryAddNewCity(): void {
    const recs = this.state.expansionRecommendations;
    if (recs.length === 0) return;
    const top = recs[0];
    if (top.score < 4.0) return;

    const c = top.candidate;
    if (this.state.cities.some(x => x.id === c.id)) return;

    this.state.cities.push({
      id: c.id, name: c.name, lat: c.lat, lng: c.lng,
      population: c.population, demandMultiplier: c.demandMultiplier,
      regionId: c.regionId, isHub: c.isHub,
    });
    this.state.coverageByCity[c.id] = 0.20;

    const region = this.state.regions.find(r => r.id === c.regionId);
    if (region && !region.cityIds.includes(c.id)) region.cityIds.push(c.id);

    const lines: InnercityLine[] = [
      { cityId: c.id, mode: 'tram'           as InnercityMode, name: 'Local Transit', coverageRadiusKm: 8,  dailyCapacity: 80_000, operational: true,  openDay: this.state.simulationDay, investmentEur: 0 },
      { cityId: c.id, mode: 'local_pod_dense'as InnercityMode, name: 'PODS Local',    coverageRadiusKm: 12, dailyCapacity: 30_000, operational: false, openDay: this.state.simulationDay + 90 + Math.floor(Math.random() * 120), investmentEur: 400_000_000 },
    ];
    this.state.innercityNetworks.push({
      cityId: c.id, lines,
      combinedCoverage: this.computeInnercityCoverage(lines),
      dailyLocalTrips: 80_000 * 0.35,
    });

    // Connect to nearest hub(s) within 700 km
    let connectTargets = this.state.cities
      .filter(e => e.id !== c.id && e.isHub)
      .map(e => ({ city: e, dist: this.haversine(c.lat, c.lng, e.lat, e.lng) }))
      .filter(x => x.dist < 700)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);

    if (connectTargets.length === 0) {
      connectTargets = this.state.cities
        .filter(e => e.id !== c.id)
        .map(e => ({ city: e, dist: this.haversine(c.lat, c.lng, e.lat, e.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
    }

    connectTargets.forEach(({ city, dist }) => {
      const openDay = this.state.simulationDay + 90 + Math.floor(Math.random() * 90);
      this.state.routes.push({
        id: `r-exp-${uuidv4().slice(0, 6)}`,
        fromCityId: c.id, toCityId: city.id,
        distanceKm: dist, maglev: dist > 150,
        estimatedMinutes: Math.round(dist / (dist > 150 ? 450 : 120) * 60),
        capsuleCapacity: 4, statusCode: 'planning',
        estimatedOpenDay: openDay,
        routeType: city.regionId !== c.regionId ? 'cross_border' : dist < 200 ? 'regional' : 'intercity',
      });
    });

    this.addCapEx('hub_construction', 150_000_000 + c.population * 40, `New hub expansion: ${c.name}`);
    this.state.expansionRecommendations = this.computeExpansionRecommendations();
  }

  public addCityFromExpansion(candidateId: string): { city: City; routes: Route[] } {
    const candidate = EU_CANDIDATE_POOL.find(c => c.id === candidateId);
    if (!candidate) throw new Error('Candidate not found in EU_CANDIDATE_POOL');
    if (this.state.cities.some(x => x.id === candidateId)) throw new Error('City already in network');

    // Force threshold override for manual addition
    this.state.expansionRecommendations = [
      { candidate, score: 99, reason: 'Manually added', estimatedDailyDemandGain: 0, bridgesCorridors: [], suggestedRoutes: [] },
      ...this.state.expansionRecommendations.filter(r => r.candidate.id !== candidateId),
    ];
    this.tryAddNewCity();
    const newCity = this.state.cities.find(c => c.id === candidateId)!;
    const newRoutes = this.state.routes.filter(r => r.fromCityId === candidateId || r.toCityId === candidateId);
    return { city: newCity, routes: newRoutes };
  }

  // ─── Dynamic events ───────────────────────────────────────────────────────

  private generateDynamicEvents(): void {
    const day = this.state.simulationDay;
    const maxScheduled = Math.max(...this.state.maintenanceEvents.map(e => e.endDay), day);
    if (maxScheduled < day + 60) this.scheduleMaintenance(maxScheduled, maxScheduled + 80);

    if (poisson(1 / 45)) {
      const region = pick(this.state.regions);
      this.state.maintenanceEvents.push({
        id: uuidv4(), type: 'planned_road', routeId: undefined,
        regionId: region.id, startDay: day, endDay: day + 3 + Math.floor(Math.random() * 5),
        severity: 'minor', description: `Demand spike in ${region.name} (event / holiday)`,
        demandBoostPct: 15 + Math.floor(Math.random() * 30), otpImpactPct: 0, active: true,
      });
    }

    if (poisson(1 / 120)) {
      const region = pick(this.state.regions);
      this.state.maintenanceEvents.push({
        id: uuidv4(), type: 'planned_road', routeId: undefined,
        regionId: region.id, startDay: day, endDay: day + 14,
        severity: 'major', description: `Major road closure in ${region.name}`,
        demandBoostPct: 45, otpImpactPct: -0.2, active: true,
      });
    }

    if (poisson(1 / 70)) {
      const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
      if (opRoutes.length > 0) {
        const route = pick(opRoutes);
        const region = this.state.regions.find(r =>
          r.cityIds.includes(route.fromCityId) || r.cityIds.includes(route.toCityId)
        ) ?? this.state.regions[0];
        this.state.maintenanceEvents.push({
          id: uuidv4(), type: 'unplanned_pods', routeId: route.id,
          regionId: region.id, startDay: day, endDay: day + 1,
          severity: 'moderate', description: `Unplanned PODS incident on ${route.fromCityId}→${route.toCityId}`,
          demandBoostPct: -8, otpImpactPct: -1.2, active: true,
        });
      }
    }

    if (poisson(1 / 300)) {
      this.addCapEx('technology', 200_000_000, 'Technology upgrade programme');
      Object.keys(this.state.coverageByCity).forEach(cid => {
        this.state.coverageByCity[cid] = Math.min(0.95, (this.state.coverageByCity[cid] ?? 0) + 0.05);
      });
    }

    if (poisson(1 / 90) && this.state.dailyMetrics.length > 30) {
      this.tryProposeNewRoute();
    }

    // Every ~200 days, auto-add the top-scored expansion candidate
    if (poisson(1 / 200) && this.state.dailyMetrics.length > 90) {
      this.tryAddNewCity();
    }
  }

  // ─── Route proposal: genuine time-improvement gated ───────────────────────

  private tryProposeNewRoute(): void {
    const existingDirect = new Set(
      this.state.routes.map(r => `${r.fromCityId}|${r.toCityId}`)
    );
    const hasDirect = (a: string, b: string) =>
      existingDirect.has(`${a}|${b}`) || existingDirect.has(`${b}|${a}`);

    const candidates: { a: City; b: City; saving: number; directMinutes: number }[] = [];

    for (let i = 0; i < this.state.cities.length; i++) {
      for (let j = i + 1; j < this.state.cities.length; j++) {
        const a = this.state.cities[i], b = this.state.cities[j];
        if (hasDirect(a.id, b.id)) continue;
        const dist = this.haversine(a.lat, a.lng, b.lat, b.lng);
        if (dist < 60) continue;

        const currentPath  = this.bestPodsPath(a.id, b.id);
        const directMins   = Math.round(dist / 450 * 60);
        // Only propose if direct route saves ≥20% travel time vs current best
        const saving = currentPath
          ? (currentPath.minutes - directMins) / currentPath.minutes
          : 1.0;
        const covOk = (this.state.coverageByCity[a.id] ?? 0) > 0.35 && (this.state.coverageByCity[b.id] ?? 0) > 0.35;
        const popOk = a.population + b.population > 800_000;

        if (saving >= 0.20 && covOk && popOk) {
          candidates.push({ a, b, saving, directMinutes: directMins });
        }
      }
    }

    if (candidates.length === 0) return;
    candidates.sort((x, y) => y.saving - x.saving);
    const best = candidates[0];
    const dist = this.haversine(best.a.lat, best.a.lng, best.b.lat, best.b.lng);
    const openDay = this.state.simulationDay + 60 + Math.floor(Math.random() * 60);
    const type: RouteType = best.a.regionId !== best.b.regionId ? 'cross_border' : dist < 200 ? 'regional' : 'intercity';
    this.state.routes.push({
      id: `r-dyn-${uuidv4().slice(0, 6)}`,
      fromCityId: best.a.id, toCityId: best.b.id,
      distanceKm: dist, maglev: dist > 150,
      estimatedMinutes: best.directMinutes,
      capsuleCapacity: 4, statusCode: 'planning',
      estimatedOpenDay: openDay, routeType: type,
    });
  }

  // ─── Coverage evolution ────────────────────────────────────────────────────

  private evolveCoverage(): void {
    const opCities = new Set(
      this.state.routes.filter(r => r.statusCode === 'operational').flatMap(r => [r.fromCityId, r.toCityId])
    );
    opCities.forEach(cid => {
      const c = this.state.coverageByCity[cid] ?? 0.5;
      if (c < 0.95) this.state.coverageByCity[cid] = Math.min(0.95, c + 0.0006 * (1 - c));
    });
    if (poisson(1 / 50) && this.state.dailyMetrics.length > 0) {
      const lowCov = this.state.cities.filter(c => (this.state.coverageByCity[c.id] ?? 0) < 0.75);
      if (lowCov.length > 0) {
        const city = pick(lowCov);
        this.state.coverageByCity[city.id] = Math.min(0.95, (this.state.coverageByCity[city.id] ?? 0.5) + 0.07);
        this.addCapEx('local_network', 35_000_000, `Local hub expansion in ${city.name}`);
      }
    }
  }

  // ─── CapEx ────────────────────────────────────────────────────────────────

  private processCapEx(): number {
    const day = this.state.simulationDay;
    let total = 0;
    const rdDecay = Math.max(0.5, 1 - day / 2000);
    total += this.addCapEx('r_and_d', 2_800_000 * rdDecay, `Daily R&D (day ${day})`);
    const constr = this.state.routes.filter(r => r.statusCode === 'construction').length;
    if (constr > 0) total += this.addCapEx('route_construction', constr * 180_000, `Construction day costs`);
    return total;
  }

  private addCapEx(category: CapExCategory, amount: number, desc: string, routeId?: string): number {
    this.state.capexLog.push({ id: uuidv4(), day: this.state.simulationDay, date: new Date(this.state.currentDate), category, amountEur: amount, description: desc, routeId });
    if (this.state.capexLog.length > 365) this.state.capexLog.shift();
    return amount;
  }

  // ─── Rollout ───────────────────────────────────────────────────────────────

  private processRollout(): void {
    this.state.routes.forEach(r => {
      if (r.statusCode === 'planning' && r.estimatedOpenDay && this.state.simulationDay >= r.estimatedOpenDay - 30) {
        r.statusCode = 'construction';
        const cost = r.routeType === 'cross_border' ? 900_000_000 : r.routeType === 'intercity' ? 700_000_000 : 300_000_000;
        this.addCapEx('route_construction', cost, `Construction start: ${r.fromCityId}→${r.toCityId}`, r.id);
      }
      if (r.statusCode === 'construction' && r.estimatedOpenDay && this.state.simulationDay >= r.estimatedOpenDay) {
        r.statusCode = 'operational';
        r.operationalSince = new Date(this.state.currentDate);
        this.spawnPodsForRoute(r);
        [r.fromCityId, r.toCityId].forEach(cid => {
          if ((this.state.coverageByCity[cid] ?? 0) < 0.55) this.state.coverageByCity[cid] = 0.55;
        });
      }
    });
  }

  private spawnPodsForRoute(route: Route): void {
    const count = 180 + Math.floor(Math.random() * 60);
    this.addCapEx('fleet_acquisition', count * 180_000, `Fleet for ${route.fromCityId}→${route.toCityId}`, route.id);
    for (let i = 0; i < count; i++) {
      this.state.pods.push({ id: `pod-${uuidv4().slice(0, 8)}`, routeId: route.id, currentPassengers: 0, capacity: 4, status: 'idle', distanceTraveledKm: 0, totalRevenueEur: 0, batteryPercentage: 99 });
    }
  }

  // ─── Innercity network initialisation ────────────────────────────────────
  // Each network city gets an initial set of innercity lines reflecting real-world
  // infrastructure maturity. Lines unlock over time via investment events.

  private initInnercityNetworks(): void {
    const cityLines: Record<string, InnercityLine[]> = {
      berlin:     [
        { cityId: 'berlin', mode: 's_bahn',        name: 'S-Bahn Ring',        coverageRadiusKm: 25, dailyCapacity: 800_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'berlin', mode: 'u_bahn',         name: 'U-Bahn Core',        coverageRadiusKm: 15, dailyCapacity: 600_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'berlin', mode: 'local_pod_dense', name: 'PODS Urban Mesh',    coverageRadiusKm: 30, dailyCapacity: 120_000, operational: true,  openDay: 0,   investmentEur: 2_000_000_000 },
        { cityId: 'berlin', mode: 'tram',            name: 'Tram East',          coverageRadiusKm: 10, dailyCapacity: 200_000, operational: true,  openDay: 0,   investmentEur: 0 },
      ],
      munich:     [
        { cityId: 'munich', mode: 's_bahn',         name: 'S-Bahn Star',        coverageRadiusKm: 40, dailyCapacity: 900_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'munich', mode: 'u_bahn',          name: 'U-Bahn Network',     coverageRadiusKm: 20, dailyCapacity: 500_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'munich', mode: 'local_pod_dense', name: 'PODS Urban Mesh',    coverageRadiusKm: 35, dailyCapacity: 100_000, operational: true,  openDay: 0,   investmentEur: 1_800_000_000 },
      ],
      frankfurt:  [
        { cityId: 'frankfurt', mode: 's_bahn',       name: 'S-Bahn RMV',        coverageRadiusKm: 45, dailyCapacity: 600_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'frankfurt', mode: 'u_bahn',        name: 'U-Bahn',            coverageRadiusKm: 12, dailyCapacity: 250_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'frankfurt', mode: 'local_pod_dense', name: 'PODS City Hub',   coverageRadiusKm: 30, dailyCapacity: 80_000,  operational: false, openDay: 200, investmentEur: 1_200_000_000 },
      ],
      hamburg:    [
        { cityId: 'hamburg', mode: 's_bahn',          name: 'S-Bahn HVV',       coverageRadiusKm: 30, dailyCapacity: 700_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'hamburg', mode: 'u_bahn',           name: 'U-Bahn',           coverageRadiusKm: 18, dailyCapacity: 350_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'hamburg', mode: 'local_pod_dense',  name: 'PODS Port Loop',   coverageRadiusKm: 28, dailyCapacity: 90_000,  operational: false, openDay: 180, investmentEur: 1_400_000_000 },
      ],
      paris:      [
        { cityId: 'paris', mode: 's_bahn',             name: 'RER Network',      coverageRadiusKm: 60, dailyCapacity: 3_000_000, operational: true, openDay: 0,  investmentEur: 0 },
        { cityId: 'paris', mode: 'u_bahn',              name: 'Métro',            coverageRadiusKm: 20, dailyCapacity: 4_500_000, operational: true, openDay: 0,  investmentEur: 0 },
        { cityId: 'paris', mode: 'local_pod_dense',     name: 'PODS Grand Paris', coverageRadiusKm: 50, dailyCapacity: 200_000, operational: false, openDay: 300, investmentEur: 3_500_000_000 },
      ],
      amsterdam:  [
        { cityId: 'amsterdam', mode: 'tram',            name: 'GVB Tram',         coverageRadiusKm: 12, dailyCapacity: 300_000, operational: true, openDay: 0,   investmentEur: 0 },
        { cityId: 'amsterdam', mode: 'u_bahn',           name: 'Metro',            coverageRadiusKm: 15, dailyCapacity: 200_000, operational: true, openDay: 0,   investmentEur: 0 },
        { cityId: 'amsterdam', mode: 'local_pod_dense',  name: 'PODS Canal Ring',  coverageRadiusKm: 18, dailyCapacity: 60_000,  operational: false, openDay: 250, investmentEur: 900_000_000 },
      ],
      vienna:     [
        { cityId: 'vienna', mode: 'u_bahn',             name: 'U-Bahn Wiener Linien', coverageRadiusKm: 22, dailyCapacity: 1_200_000, operational: true, openDay: 0, investmentEur: 0 },
        { cityId: 'vienna', mode: 'tram',                name: 'Straßenbahn',       coverageRadiusKm: 18, dailyCapacity: 600_000, operational: true, openDay: 0,   investmentEur: 0 },
        { cityId: 'vienna', mode: 'local_pod_dense',     name: 'PODS Ringstraße',   coverageRadiusKm: 25, dailyCapacity: 90_000,  operational: false, openDay: 220, investmentEur: 1_500_000_000 },
      ],
      zurich:     [
        { cityId: 'zurich', mode: 's_bahn',             name: 'S-Bahn ZVV',       coverageRadiusKm: 50, dailyCapacity: 800_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'zurich', mode: 'tram',                name: 'VBZ Tram',         coverageRadiusKm: 10, dailyCapacity: 300_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'zurich', mode: 'gondola',             name: 'Polybahn',         coverageRadiusKm:  2, dailyCapacity:  10_000, operational: true,  openDay: 0,   investmentEur: 0 },
        { cityId: 'zurich', mode: 'local_pod_dense',     name: 'PODS Limmat Line', coverageRadiusKm: 20, dailyCapacity: 50_000,  operational: false, openDay: 150, investmentEur: 700_000_000 },
      ],
    };

    this.state.cities.forEach(city => {
      const lines = cityLines[city.id] ?? [
        { cityId: city.id, mode: 'tram' as InnercityMode, name: 'Local Transit', coverageRadiusKm: 8, dailyCapacity: 80_000, operational: true, openDay: 0, investmentEur: 0 },
        { cityId: city.id, mode: 'local_pod_dense' as InnercityMode, name: 'PODS Local', coverageRadiusKm: 12, dailyCapacity: 30_000, operational: false, openDay: 100 + Math.floor(Math.random() * 200), investmentEur: 400_000_000 },
      ];
      const combined = this.computeInnercityCoverage(lines);
      this.state.innercityNetworks.push({
        cityId: city.id, lines, combinedCoverage: combined,
        dailyLocalTrips: lines.filter(l => l.operational).reduce((s, l) => s + l.dailyCapacity, 0) * 0.35,
      });
    });
  }

  private computeInnercityCoverage(lines: InnercityLine[]): number {
    const opLines = lines.filter(l => l.operational);
    if (opLines.length === 0) return 0.10;
    // Coverage is a function of radius and mode density (simplified)
    const maxRadius = Math.max(...opLines.map(l => l.coverageRadiusKm));
    const modeBonus = opLines.some(l => l.mode === 'local_pod_dense') ? 0.15 : 0;
    return Math.min(0.95, 0.30 + Math.log(maxRadius / 5 + 1) * 0.25 + modeBonus);
  }

  private evolveInnercityNetworks(): void {
    const day = this.state.simulationDay;
    this.state.innercityNetworks.forEach(net => {
      let changed = false;
      net.lines.forEach(line => {
        if (!line.operational && day >= line.openDay) {
          line.operational = true;
          this.addCapEx('local_network', line.investmentEur, `${line.name} opens in ${net.cityId}`);
          changed = true;
        }
      });
      if (changed) {
        net.combinedCoverage = this.computeInnercityCoverage(net.lines);
        net.dailyLocalTrips  = net.lines.filter(l => l.operational).reduce((s, l) => s + l.dailyCapacity, 0) * 0.35;
        // Better innercity coverage boosts PODS hub access
        this.state.coverageByCity[net.cityId] = Math.min(0.95,
          (this.state.coverageByCity[net.cityId] ?? 0.5) + 0.08
        );
      }
    });
  }

  // ─── City expansion recommender ───────────────────────────────────────────
  // Analyses live simulation state to recommend next cities to add to the network.
  // Uses three signals:
  //   1. Gravity demand gap: large-population cities not yet served
  //   2. Corridor bridging: does adding this city shorten existing multi-hop paths?
  //   3. Coverage density: are there geographic gaps between existing cities?

  public computeExpansionRecommendations(): CityExpansionRecommendation[] {
    const existingIds = new Set(this.state.cities.map(c => c.id));
    const eligible = EU_CANDIDATE_POOL.filter(c => !existingIds.has(c.id));
    if (eligible.length === 0) return [];

    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    const totalDailyServed = this.state.dailyMetrics.slice(-7)
      .reduce((s, m) => s + m.totalPassengers, 0) / Math.max(this.state.dailyMetrics.slice(-7).length, 1);

    const results: CityExpansionRecommendation[] = [];

    for (const candidate of eligible) {
      let score = 0;
      const reasons: string[] = [];
      const bridgesCorridors: string[] = [];
      const suggestedRoutes: { toCity: string; timeSavingPct: number }[] = [];

      // ── Signal 1: gravity demand gap ──────────────────────────────────────
      // How much demand would this city create with the existing network?
      let gravityScore = 0;
      this.state.cities.forEach(existing => {
        const dist = this.haversine(candidate.lat, candidate.lng, existing.lat, existing.lng);
        if (dist < 40 || dist > 1200) return;
        gravityScore += Math.sqrt(candidate.population * existing.population) / dist
          * candidate.demandMultiplier * existing.demandMultiplier;
      });
      gravityScore /= 1_000_000; // normalise
      score += gravityScore * 2;
      if (gravityScore > 5) reasons.push(`High gravity potential (score ${gravityScore.toFixed(1)}) — large population relative to nearest cities`);

      // ── Signal 2: corridor bridging ───────────────────────────────────────
      // Does adding this city as an intermediate hub reduce travel time on any long route?
      opRoutes.forEach(route => {
        const from = this.state.cities.find(c => c.id === route.fromCityId);
        const to   = this.state.cities.find(c => c.id === route.toCityId);
        if (!from || !to) return;
        if (route.distanceKm < 250) return; // only long routes benefit from new hubs

        const distViaCandidate =
          this.haversine(from.lat, from.lng, candidate.lat, candidate.lng) +
          this.haversine(candidate.lat, candidate.lng, to.lat, to.lng);

        // Is the candidate between these two cities (within 20% of direct distance)?
        if (distViaCandidate < route.distanceKm * 1.20) {
          const directMins   = route.estimatedMinutes;
          const viaMins      = Math.round(distViaCandidate / 450 * 60) + 15; // +15 stop
          const saving       = (directMins - viaMins) / directMins;
          if (saving > 0.05) { // >5% saving
            bridgesCorridors.push(`${from.name}→${to.name}`);
            score += saving * 3;
          }
        }
      });
      if (bridgesCorridors.length > 0) reasons.push(`Bridges ${bridgesCorridors.length} corridor(s): ${bridgesCorridors.slice(0, 2).join(', ')}`);

      // ── Signal 3: geographic coverage gap ─────────────────────────────────
      const nearestExistingDist = Math.min(...this.state.cities.map(c =>
        this.haversine(candidate.lat, candidate.lng, c.lat, c.lng)
      ));
      if (nearestExistingDist > 120) {
        score += nearestExistingDist / 80;
        reasons.push(`Fills geographic gap — nearest city is ${Math.round(nearestExistingDist)} km away`);
      }

      // ── Suggested routes ─────────────────────────────────────────────────
      // Find top 3 existing cities to connect to
      const connectTo = this.state.cities
        .map(c => {
          const dist = this.haversine(candidate.lat, candidate.lng, c.lat, c.lng);
          const currentPath = this.bestPodsPath(c.id, this.state.cities[0].id); // proxy
          const directMins  = Math.round(dist / 450 * 60);
          return { city: c, dist, directMins };
        })
        .filter(x => x.dist > 60 && x.dist < 800)
        .sort((a, b) => {
          const popA = Math.sqrt(candidate.population * a.city.population) / a.dist;
          const popB = Math.sqrt(candidate.population * b.city.population) / b.dist;
          return popB - popA;
        })
        .slice(0, 3);

      connectTo.forEach(({ city, dist }) => {
        suggestedRoutes.push({ toCity: city.name, timeSavingPct: Math.round(Math.random() * 15 + 5) });
      });

      const estimatedDailyGain = Math.round(gravityScore * 1200 * (this.state.coverageByCity[this.state.cities[0]?.id ?? ''] ?? 0.65));

      if (score > 1.5 && reasons.length > 0) {
        results.push({ candidate, score, reason: reasons.join('; '), estimatedDailyDemandGain: estimatedDailyGain, bridgesCorridors, suggestedRoutes });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  // ─── Daily metrics ────────────────────────────────────────────────────────

  private buildDailyMetrics(dailyCapEx: number): DailyMetrics {
    const activeEvents = this.state.maintenanceEvents.filter(e => e.active);
    const otpHit  = activeEvents.reduce((s, e) => s + e.otpImpactPct, 0);
    const otpNoise = (Math.random() - 0.5) * 2 * 0.01;
    const otp = Math.max(92, Math.min(99.5, 97.5 + otpNoise * 100 + otpHit));

    const demand = this.buildDemand();
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational');
    const travelingPods = this.state.pods.filter(p => p.status === 'traveling').length;
    const tripSplit = this.tripSplit(opRoutes, demand.servedTrips);

    // Tiered pricing: commuter subscription, business premium, vacation discount
    const COMMUTER_PRICE_PER_TRIP = 149 / 22;   // €149/month subscription ÷ 22 workdays
    const BUSINESS_PRICE_PER_KM  = 0.18;         // business premium rate
    const VACATION_PRICE_PER_KM  = 0.07;         // vacation discount rate
    const totalRevenue =
      tripSplit.commute  * COMMUTER_PRICE_PER_TRIP +
      tripSplit.business * 280 * BUSINESS_PRICE_PER_KM +
      tripSplit.vacation * 420 * VACATION_PRICE_PER_KM;
    const avgTicket = demand.servedTrips > 0 ? totalRevenue / demand.servedTrips : 22;
    const annualOpex = 650_000_000 + this.state.pods.length * 65_000 + opRoutes.length * 8_000_000;
    const avgDistKm = 220;

    return {
      date: new Date(this.state.currentDate),
      totalPassengers:        demand.servedTrips,
      totalRevenueEur:        totalRevenue,
      totalOperatingCostEur:  annualOpex / 365,
      podUtilizationPercent:  this.state.pods.length > 0 ? (travelingPods / this.state.pods.length) * 100 : 0,
      routeOperationalPercent: opRoutes.length / Math.max(this.state.routes.length, 1) * 100,
      averageTicketPriceEur:  avgTicket,
      onTimePerformancePct:   otp,
      tripsByType:            tripSplit,
      modalChains:            this.modalChains(tripSplit),
      demand,
      demandBoostFromMaintenancePct: activeEvents.reduce((s, e) => s + e.demandBoostPct, 0),
      activeMaintenanceCount: activeEvents.length,
      revenuePerPassengerKm:  demand.servedTrips > 0 ? totalRevenue / (demand.servedTrips * avgDistKm) : 0,
      dailyCapEx,
    };
  }

  private updatePodStates(_totalServed: number): void {
    const opRoutes  = this.state.routes.filter(r => r.statusCode === 'operational');
    const pausedIds = new Set(this.state.routes.filter(r => r.statusCode === 'paused').map(r => r.id));
    const totalW    = opRoutes.reduce((s, r) => {
      const a = this.state.cities.find(c => c.id === r.fromCityId);
      const b = this.state.cities.find(c => c.id === r.toCityId);
      return s + (a && b ? Math.sqrt(a.population * b.population) / r.distanceKm : 0);
    }, 0) || 1;

    this.state.pods.forEach(pod => {
      if (pausedIds.has(pod.routeId)) { pod.status = 'maintenance'; return; }
      const route = this.state.routes.find(r => r.id === pod.routeId);
      if (!route || route.statusCode !== 'operational') return;
      const a = this.state.cities.find(c => c.id === route.fromCityId);
      const b = this.state.cities.find(c => c.id === route.toCityId);
      const w = a && b ? Math.sqrt(a.population * b.population) / route.distanceKm : 0;
      const travelProb = Math.min(0.55, 0.15 + (w / totalW) * this.state.cities.length * 0.8);
      const rnd = Math.random();
      if (rnd < travelProb) {
        pod.status = 'traveling';
        pod.currentPassengers = Math.min(pod.capacity, 1 + Math.floor(Math.random() * pod.capacity));
        pod.distanceTraveledKm += route.distanceKm / (route.estimatedMinutes / 60);
        pod.totalRevenueEur    += pod.currentPassengers * route.distanceKm * 0.10;
      } else if (rnd < travelProb + 0.35) {
        pod.status = 'at_hub'; pod.currentPassengers = 0;
        pod.batteryPercentage = Math.min(100, pod.batteryPercentage + 8);
      } else {
        pod.status = 'idle'; pod.currentPassengers = 0;
      }
    });
  }

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

  private computeRegional(daily: DailyMetrics): RegionalSnapshot[] {
    return this.state.regions.map(region => {
      const citySet = new Set(region.cityIds);
      const rRoutes = this.state.routes.filter(r =>
        r.statusCode === 'operational' && (citySet.has(r.fromCityId) || citySet.has(r.toCityId))
      );
      const rPods = this.state.pods.filter(p => rRoutes.some(r => r.id === p.routeId));
      const frac  = rRoutes.length / Math.max(this.state.routes.filter(r => r.statusCode === 'operational').length, 1);
      const pax   = Math.round(daily.totalPassengers * frac);
      const split = this.tripSplit(rRoutes, pax);
      const dom: TripType = split.commute > split.business && split.commute > split.vacation ? 'commute'
        : split.business > split.vacation ? 'business' : 'vacation';
      const avgDist =
        (split.commute  / Math.max(pax, 1)) * region.avgCommuteDistanceKm +
        (split.business / Math.max(pax, 1)) * region.avgBusinessDistanceKm +
        (split.vacation / Math.max(pax, 1)) * region.avgVacationDistanceKm;
      const otp = Math.max(92, Math.min(99.5, daily.onTimePerformancePct + (Math.random() - 0.5) * 0.5));
      const covAvg = region.cityIds.reduce((s, cid) => s + (this.state.coverageByCity[cid] ?? 0), 0) / region.cityIds.length;
      return {
        regionId: region.id, regionName: region.name,
        totalDailyPassengers: pax, avgTripDistanceKm: Math.round(avgDist),
        onTimePerformancePct: Math.round(otp * 10) / 10, dominantTripType: dom,
        activePods: rPods.filter(p => p.status === 'traveling').length,
        operationalRoutes: rRoutes.length, revenueEur: daily.totalRevenueEur * frac,
        coverage: Math.round(covAvg * 1000) / 1000,
      };
    });
  }

  // ─── Financial metrics ────────────────────────────────────────────────────

  public getFinancialMetrics() {
    const recent = this.state.dailyMetrics.slice(-365);
    if (recent.length === 0) return this.emptyMetrics();
    const avg = (fn: (m: DailyMetrics) => number) => recent.reduce((s, m) => s + fn(m), 0) / recent.length;
    const avgRevenue = avg(m => m.totalRevenueEur);
    const avgOpex    = avg(m => m.totalOperatingCostEur);
    const avgCapEx   = avg(m => m.dailyCapEx);
    const r7  = this.state.dailyMetrics.slice(-7);
    const r90 = this.state.dailyMetrics.slice(-90);
    const seasonal = r90.length > 0
      ? (r7.reduce((s, m) => s + m.totalPassengers, 0) / Math.max(r7.length, 1)) /
        (r90.reduce((s, m) => s + m.totalPassengers, 0) / r90.length) : null;
    const opCities = new Set(this.state.routes.filter(r => r.statusCode === 'operational').flatMap(r => [r.fromCityId, r.toCityId]));
    const capexByCategory: Record<string, number> = {};
    this.state.capexLog.forEach(r => { capexByCategory[r.category] = (capexByCategory[r.category] || 0) + r.amountEur; });
    const opRoutes = this.state.routes.filter(r => r.statusCode === 'operational').length;
    const dailyProfit = (avgRevenue - avgOpex) / Math.max(opRoutes, 1);
    return {
      annualProjection:        avgRevenue * 365,
      avgDailyRevenue:         avgRevenue,
      avgDailyOpex:            avgOpex,
      avgDailyCapEx:           avgCapEx,
      profitMargin:            avgRevenue > 0 ? (avgRevenue - avgOpex) / avgRevenue * 100 : null,
      ebitda:                  (avgRevenue - avgOpex) * 365,
      cumulativeRevenue:       this.state.cumulativeRevenue,
      cumulativeOpex:          this.state.cumulativeOpex,
      cumulativeCapEx:         this.state.cumulativeCapEx,
      netProfitYtd:            this.state.cumulativeRevenue - this.state.cumulativeOpex,
      totalInvestment:         this.state.cumulativeCapEx,
      roi: this.state.cumulativeCapEx > 0
        ? (this.state.cumulativeRevenue - this.state.cumulativeOpex - (this.state.cumulativeCapEx - PODSSimulationEngine.HISTORICAL_CAPEX_EUR)) / this.state.cumulativeCapEx * 100
        : null,
      avgOnTimePerformancePct:  Math.round(avg(m => m.onTimePerformancePct) * 10) / 10,
      avgRevenuePerPassengerKm: Math.round(avg(m => m.revenuePerPassengerKm) * 100) / 100,
      seasonalDemandIndex:      seasonal ? Math.round(seasonal * 100) / 100 : null,
      networkReachPct:          Math.round(opCities.size / this.state.cities.length * 100),
      breakEvenDays:            dailyProfit > 0 ? Math.round(800_000_000 / dailyProfit) : null,
      capexByCategory,
      latestDemand:             this.state.dailyMetrics.slice(-1)[0]?.demand ?? null,
      avgFulfillmentRate:       Math.round(avg(m => m.demand?.fulfillmentRate ?? 0) * 1000) / 1000,
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

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private tick(): void {
    this.state.simulationDay++;
    this.state.currentDate = new Date(this.state.currentDate.getTime() + 86_400_000);
    this.processRollout();
    this.updateMaintenance();
    this.generateDynamicEvents();
    this.evolveCoverage();
    this.evolveInnercityNetworks();
    // Refresh expansion recommendations every 30 sim-days (not every tick — it's expensive)
    if (this.state.simulationDay % 30 === 0) {
      this.state.expansionRecommendations = this.computeExpansionRecommendations();
    }
    const capex = this.processCapEx();
    const metrics = this.buildDailyMetrics(capex);
    this.state.dailyMetrics.push(metrics);
    this.state.cumulativeRevenue += metrics.totalRevenueEur;
    this.state.cumulativeOpex   += metrics.totalOperatingCostEur;
    this.state.cumulativeCapEx  += capex;
    this.updatePodStates(metrics.totalPassengers);
    this.state.latestRegionalMetrics = this.computeRegional(metrics);
    this.notifySubscribers();
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
    const a = Math.sin(dl / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dL / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export default PODSSimulationEngine;
