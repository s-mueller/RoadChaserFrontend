import {CoverageDto, SummitCoverageDto} from './model';

describe('CoverageDto', () => {
  it('should create an instance with default values', () => {
    const dto: CoverageDto = {
      coverage: 0,
      totalTrailLength: 0,
      numberOfTracksChecked: 0,
      numberOfTrailsChecked: 0,
      lastCalculated: '',
      lastSyncedWithStrava: '',
      totalElevationGain: 0,
      totalDistance: 0
    };
    expect(dto).toBeDefined();
    expect(dto.coverage).toBe(0);
    expect(dto.totalTrailLength).toBe(0);
    expect(dto.totalElevationGain).toBe(0);
    expect(dto.totalDistance).toBe(0);
  });

  it('should accept realistic coverage data', () => {
    const dto: CoverageDto = {
      coverage: 45.5,
      totalTrailLength: 250000,
      numberOfTracksChecked: 150,
      numberOfTrailsChecked: 80,
      lastCalculated: '2024-06-15T10:30:00Z',
      lastSyncedWithStrava: '2024-06-15T10:00:00Z',
      totalElevationGain: 50000,
      totalDistance: 120000
    };
    expect(dto.coverage).toBe(45.5);
    expect(dto.totalTrailLength).toBe(250000);
    expect(dto.numberOfTracksChecked).toBe(150);
    expect(dto.numberOfTrailsChecked).toBe(80);
    expect(dto.totalElevationGain).toBe(50000);
    expect(dto.totalDistance).toBe(120000);
  });

  it('should accept fractional coverage value', () => {
    const dto: CoverageDto = {
      coverage: 12.34,
      totalTrailLength: 50000,
      numberOfTracksChecked: 10,
      numberOfTrailsChecked: 5,
      lastCalculated: '2024-01-01T00:00:00Z',
      lastSyncedWithStrava: '2024-01-01T00:00:00Z',
      totalElevationGain: 1000,
      totalDistance: 30000
    };
    expect(dto.coverage).toBeCloseTo(12.34, 2);
  });
});

describe('SummitCoverageDto', () => {
  it('should create an instance with default values', () => {
    const dto: SummitCoverageDto = {
      totalSummits: 0,
      visitedSummits: 0,
      totalVisits: 0,
      summitDetails: [],
      lastCalculated: '',
      lastSyncedWithStrava: ''
    };
    expect(dto).toBeDefined();
    expect(dto.totalSummits).toBe(0);
    expect(dto.visitedSummits).toBe(0);
    expect(dto.totalVisits).toBe(0);
    expect(dto.summitDetails).toEqual([]);
  });

  it('should accept summit coverage with details', () => {
    const dto: SummitCoverageDto = {
      totalSummits: 50,
      visitedSummits: 20,
      totalVisits: 35,
      summitDetails: [
        { name: 'Falknis', visits: 3, lat: 47.05, lon: 9.56, uuid: 'abc-123' },
        { name: 'Augstenberg', visits: 0, lat: 47.08, lon: 9.53, uuid: 'def-456' }
      ],
      lastCalculated: '2024-06-15T10:30:00Z',
      lastSyncedWithStrava: '2024-06-15T10:00:00Z'
    };
    expect(dto.totalSummits).toBe(50);
    expect(dto.visitedSummits).toBe(20);
    expect(dto.totalVisits).toBe(35);
    expect(dto.summitDetails.length).toBe(2);
    expect(dto.summitDetails[0].name).toBe('Falknis');
    expect(dto.summitDetails[0].visits).toBe(3);
    expect(dto.summitDetails[0].lat).toBe(47.05);
    expect(dto.summitDetails[0].lon).toBe(9.56);
    expect(dto.summitDetails[0].uuid).toBe('abc-123');
  });

  it('should handle empty summit details', () => {
    const dto: SummitCoverageDto = {
      totalSummits: 0,
      visitedSummits: 0,
      totalVisits: 0,
      summitDetails: [],
      lastCalculated: '',
      lastSyncedWithStrava: ''
    };
    expect(dto.summitDetails).toEqual([]);
  });
});

describe('SummitDetail', () => {
  it('should distinguish visited vs unvisited summits', () => {
    const visited = { name: 'Visited Summit', visits: 5, lat: 47.1, lon: 9.5, uuid: 'v1' };
    const unvisited = { name: 'Unvisited Summit', visits: 0, lat: 47.2, lon: 9.6, uuid: 'u1' };

    expect(visited.visits).toBeGreaterThan(0);
    expect(unvisited.visits).toBe(0);
  });
});
