import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {RoadChaserService} from './roadchaser.service';
import {CoverageDto, SummitCoverageDto} from './model';

describe('RoadChaserService', () => {
  let service: RoadChaserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RoadChaserService]
    });
    service = TestBed.inject(RoadChaserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('apiUrl', () => {
    it('should use the environment apiUrl', () => {
      expect(service.apiUrl).toBe('/api');
    });
  });

  describe('tileBaseUrl', () => {
    it('should prepend window origin for relative apiUrl', () => {
      // apiUrl is '/api' (relative), so tileBaseUrl should be window.location.origin + '/api'
      const expected = window.location.origin + '/api';
      expect(service.tileBaseUrl).toBe(expected);
    });
  });

  describe('getCoverage', () => {
    it('should GET coverage data for a road type', () => {
      const mockResponse: CoverageDto = {
        coverage: 55,
        totalTrailLength: 150000,
        numberOfTracksChecked: 80,
        numberOfTrailsChecked: 40,
        lastCalculated: '2024-06-15T10:30:00Z',
        lastSyncedWithStrava: '2024-06-15T10:00:00Z',
        totalElevationGain: 30000,
        totalDistance: 80000
      };

      service.getCoverage('WANDERWEG').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/data/WANDERWEG');
      expect(req.request.method).toBe('GET');
      expect(req.request.url).toBe('/api/data/WANDERWEG');
      req.flush(mockResponse);
    });

    it('should handle different road types', () => {
      service.getCoverage('NETWORK').subscribe();
      const req = httpMock.expectOne('/api/data/NETWORK');
      expect(req.request.method).toBe('GET');
      req.flush({} as CoverageDto);
    });
  });

  describe('getSummitCoverage', () => {
    it('should GET summit coverage for a region', () => {
      const mockResponse: SummitCoverageDto = {
        totalSummits: 50,
        visitedSummits: 20,
        totalVisits: 35,
        summitDetails: [
          {name: 'Falknis', visits: 3, lat: 47.05, lon: 9.56, uuid: 'abc'},
          {name: 'Augstenberg', visits: 0, lat: 47.08, lon: 9.53, uuid: 'def'}
        ],
        lastCalculated: '2024-06-15T10:30:00Z',
        lastSyncedWithStrava: '2024-06-15T10:00:00Z'
      };

      service.getSummitCoverage('SUMMITS_LIECHTENSTEIN').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/summits/SUMMITS_LIECHTENSTEIN');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('calculateSummitCoverage', () => {
    it('should POST to recalculate summit coverage for a region', () => {
      const mockResponse: SummitCoverageDto = {
        totalSummits: 50,
        visitedSummits: 25,
        totalVisits: 40,
        summitDetails: [],
        lastCalculated: '2024-06-15T12:00:00Z',
        lastSyncedWithStrava: '2024-06-15T11:00:00Z'
      };

      service.calculateSummitCoverage('SUMMITS_LIECHTENSTEIN').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/summits/recalculate/SUMMITS_LIECHTENSTEIN');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors for getCoverage', () => {
      const mockError = {status: 500, statusText: 'Server Error'};

      service.getCoverage('WANDERWEG').subscribe({
        error: err => {
          expect(err.status).toBe(500);
        }
      });

      const req = httpMock.expectOne('/api/data/WANDERWEG');
      req.flush('Server error', mockError);
    });

    it('should propagate HTTP errors for calculateSummitCoverage', () => {
      service.calculateSummitCoverage('SUMMITS_LIECHTENSTEIN').subscribe({
        error: err => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne('/api/summits/recalculate/SUMMITS_LIECHTENSTEIN');
      req.flush('Not found', {status: 404, statusText: 'Not Found'});
    });
  });
});
