import {TestBed, ComponentFixture} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {AppComponent} from './app.component';
import {RoadChaserService} from './roadchaser.service';
import {CoverageDto, SummitCoverageDto} from './model';
import {of, throwError} from 'rxjs';
import maplibregl from 'maplibre-gl';

/** Mock summit click event. */
const SUMMIT_CLICK_EVENT = {
  point: {x: 100, y: 200},
  lngLat: {lng: 9.5, lat: 47.1}
};

const MOCK_COVERAGE: CoverageDto = {
  coverage: 45,
  totalTrailLength: 250_000,
  numberOfTracksChecked: 150,
  numberOfTrailsChecked: 80,
  lastCalculated: '2024-06-15T10:30:00Z',
  lastSyncedWithStrava: '2024-06-15T10:00:00Z',
  totalElevationGain: 50_000,
  totalDistance: 120_000
};

const MOCK_SUMMIT_COVERAGE: SummitCoverageDto = {
  totalSummits: 50,
  visitedSummits: 20,
  totalVisits: 35,
  summitDetails: [
    {name: 'Falknis', visits: 3, lat: 47.05, lon: 9.56, uuid: 'abc-123'},
    {name: 'Augstenberg', visits: 0, lat: 47.08, lon: 9.53, uuid: 'def-456'}
  ],
  lastCalculated: '2024-06-15T10:30:00Z',
  lastSyncedWithStrava: '2024-06-15T10:00:00Z'
};

const EMPTY_GEOJSON = {type: 'FeatureCollection', features: [] as any[]};

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let mockService: jasmine.SpyObj<RoadChaserService>;
  let httpMock: HttpTestingController;
  let mockMap: any;
  let mockPopup: any;
  let eventHandlers: {[event: string]: Function[]};

  function createMockMap() {
    eventHandlers = {};

    const mockGeoJSONSource = jasmine.createSpyObj('GeoJSONSource', ['setData']);

    const map = jasmine.createSpyObj('Map', [
      'on', 'off', 'addSource', 'addLayer', 'getSource', 'getLayer',
      'removeLayer', 'flyTo', 'addControl', 'removeControl',
      'getCanvas', 'queryRenderedFeatures', 'getStyle', 'setStyle',
      'remove', 'resize', 'getCenter', 'getZoom', 'setCenter', 'setZoom',
      'isMoving', 'isLoaded', 'isSourceLoaded', 'loaded', 'dragPan',
      'getContainer', 'getBounds', 'fitBounds', 'panTo', 'zoomTo'
    ]);

    map.on.and.callFake((event: string, ...args: any[]) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(args[args.length - 1]);
    });

    map.getCanvas.and.returnValue({style: {cursor: ''}});
    map.getSource.and.returnValue(mockGeoJSONSource);
    map.getLayer.and.returnValue(null);
    map.queryRenderedFeatures.and.returnValue([]);
    map.loaded.and.returnValue(true);

    return map;
  }

  function createMockPopup() {
    const popup = jasmine.createSpyObj('Popup', [
      'setLngLat', 'setHTML', 'addTo', 'remove', 'setDOMContent',
      'getElement', 'isOpen', 'getLngLat'
    ]);
    popup.setLngLat.and.returnValue(popup);
    popup.setHTML.and.returnValue(popup);
    popup.addTo.and.returnValue(popup);
    return popup;
  }

  function setupServiceMock() {
    mockService = jasmine.createSpyObj('RoadChaserService', [
      'getCoverage', 'getSummitCoverage', 'calculateSummitCoverage',
      'getCoveredTrailsGeoJson', 'getHeatmapGeoJson', 'getBackendVersion'
    ]);
    mockService.apiUrl = '/api';
    mockService.tileBaseUrl = 'http://localhost/api';
    mockService.getCoverage.and.returnValue(of(MOCK_COVERAGE));
    mockService.getSummitCoverage.and.returnValue(of(MOCK_SUMMIT_COVERAGE));
    mockService.calculateSummitCoverage.and.returnValue(of(MOCK_SUMMIT_COVERAGE));
    mockService.getCoveredTrailsGeoJson.and.returnValue(of(EMPTY_GEOJSON));
    mockService.getHeatmapGeoJson.and.returnValue(of(EMPTY_GEOJSON));
    mockService.getBackendVersion.and.returnValue(of({backendVersion: '1.0.0'}));
  }

  function createComponentOnly() {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  }

  function createAndInit(flushVersion: string = '1.0.0') {
    mockService.getBackendVersion.and.returnValue(of({backendVersion: flushVersion}));
    createComponentOnly();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockMap = createMockMap();
    mockPopup = createMockPopup();

    spyOn(maplibregl, 'Map').and.returnValue(mockMap as any);
    spyOn(maplibregl, 'Popup').and.returnValue(mockPopup as any);
    spyOn(maplibregl, 'GeolocateControl').and.returnValue({} as any);

    setupServiceMock();

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AppComponent],
      providers: [
        {provide: RoadChaserService, useValue: mockService}
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // -----------------------------------------------------------------------
  //  Component creation
  // -----------------------------------------------------------------------
  describe('creation', () => {
    it('should create the component and fetch backend version', () => {
      createAndInit('2.0.0');
      expect(component).toBeTruthy();
      expect(component.backendVersion).toBe('2.0.0');
    });

    it('should set initial default state', () => {
      createComponentOnly();
      expect(component.showCoverage).toBeTrue();
      expect(component.isLoading).toBeFalse();
      expect(component.showRegionDropdown).toBeFalse();
      expect(component.isSummitRegion).toBeFalse();
      expect(component.selectedRegionValue).toBe('WANDERWEG');
      expect(component.loadedSources).toEqual([]);
      expect(component.addedLayerIds.size).toBe(0);
    });

    it('should set frontendVersion from environment', () => {
      createComponentOnly();
      expect(component.frontendVersion).toBeDefined();
      expect(typeof component.frontendVersion).toBe('string');
    });

    it('should handle backend version fetch error gracefully', () => {
      mockService.getBackendVersion.and.returnValue(throwError(() => new Error('Network error')));
      createComponentOnly();
      fixture.detectChanges();
      expect(component.backendVersion).toBe('n/a');
    });
  });

  // -----------------------------------------------------------------------
  //  Map initialization (ngAfterViewInit)
  // -----------------------------------------------------------------------
  describe('map initialization', () => {
    it('should create maplibregl.Map in ngAfterViewInit', () => {
      createComponentOnly();
      expect(maplibregl.Map).not.toHaveBeenCalled();

      fixture.detectChanges();

      expect(maplibregl.Map).toHaveBeenCalledTimes(1);
      const mapArgs = (maplibregl.Map as unknown as jasmine.Spy).calls.mostRecent().args[0];
      expect(mapArgs.container).toBe('map');
      expect(mapArgs.zoom).toBe(11);
      expect(mapArgs.center).toEqual([9.512414314597644, 47.165517853530986]);
    });

    it('should add GeolocateControl to the map', () => {
      createAndInit();
      expect(mockMap.addControl).toHaveBeenCalled();
      expect(maplibregl.GeolocateControl).toHaveBeenCalled();
    });

    it('should register click and load event handlers', () => {
      createAndInit();
      expect(mockMap.on).toHaveBeenCalledWith('click', jasmine.any(Function));
      expect(mockMap.on).toHaveBeenCalledWith('load', jasmine.any(Function));
    });

    it('should trigger loadTrails on map load event', () => {
      createAndInit();
      const loadHandler = eventHandlers['load'][0];
      loadHandler();

      expect(mockMap.addSource).toHaveBeenCalledWith('trails-liechtenstein', jasmine.objectContaining({
        type: 'vector',
        minzoom: 0,
        maxzoom: 14
      }));
      expect(mockService.getCoveredTrailsGeoJson).toHaveBeenCalledWith('WANDERWEG');
      expect(mockService.getCoverage).toHaveBeenCalledWith('WANDERWEG');
      expect(mockMap.flyTo).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  //  Region label
  // -----------------------------------------------------------------------
  describe('selectedRegionLabel', () => {
    it('should return label for default region', () => {
      createComponentOnly();
      expect(component.selectedRegionLabel).toBe('Wanderwege');
    });

    it('should return correct label for NETWORK', () => {
      createComponentOnly();
      component.selectedRegionValue = 'NETWORK';
      expect(component.selectedRegionLabel).toBe('Alle Strassen und Wege');
    });

    it('should return correct label for summit regions', () => {
      createComponentOnly();
      component.selectedRegionValue = 'SUMMITS_LIECHTENSTEIN';
      expect(component.selectedRegionLabel).toBe('Gipfel');
    });

    it('should return raw value for unknown region', () => {
      createComponentOnly();
      component.selectedRegionValue = 'UNKNOWN_REGION';
      expect(component.selectedRegionLabel).toBe('UNKNOWN_REGION');
    });
  });

  // -----------------------------------------------------------------------
  //  Dropdown
  // -----------------------------------------------------------------------
  describe('toggleRegionDropdown', () => {
    it('should toggle showRegionDropdown', () => {
      createComponentOnly();
      expect(component.showRegionDropdown).toBeFalse();
      component.toggleRegionDropdown();
      expect(component.showRegionDropdown).toBeTrue();
      component.toggleRegionDropdown();
      expect(component.showRegionDropdown).toBeFalse();
    });
  });

  describe('onDocumentClick', () => {
    it('should close dropdown on document click', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      component.onDocumentClick();
      expect(component.showRegionDropdown).toBeFalse();
    });

    it('should be triggered by HostListener', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      document.dispatchEvent(new Event('click'));
      expect(component.showRegionDropdown).toBeFalse();
    });
  });

  // -----------------------------------------------------------------------
  //  selectRegion
  // -----------------------------------------------------------------------
  describe('selectRegion', () => {
    it('should select a non-summit region and call load', () => {
      createComponentOnly();
      spyOn(component, 'load');
      component.selectRegion('NETWORK', new MouseEvent('click'));

      expect(component.selectedRegionValue).toBe('NETWORK');
      expect(component.isSummitRegion).toBeFalse();
      expect(component.showRegionDropdown).toBeFalse();
      expect(component.showCoverage).toBeTrue();
      expect(component.load).toHaveBeenCalled();
    });

    it('should set isSummitRegion for SUMMITS_ regions', () => {
      createComponentOnly();
      spyOn(component, 'load');
      component.selectRegion('SUMMITS_LIECHTENSTEIN');

      expect(component.isSummitRegion).toBeTrue();
    });

    it('should stop event propagation when event is provided', () => {
      createComponentOnly();
      spyOn(component, 'load');
      const event = new MouseEvent('click');
      spyOn(event, 'stopPropagation');
      component.selectRegion('WANDERWEG', event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  //  load() dispatch
  // -----------------------------------------------------------------------
  describe('load routing', () => {
    beforeEach(() => {
      createAndInit();
    });

    it('should route to loadTrails for WANDERWEG', () => {
      component.load('WANDERWEG');
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-liechtenstein', jasmine.any(Object));
      expect(mockService.getCoveredTrailsGeoJson).toHaveBeenCalledWith('WANDERWEG');
      expect(mockService.getCoverage).toHaveBeenCalledWith('WANDERWEG');
    });

    it('should route to loadNetwork for NETWORK', () => {
      component.load('NETWORK');
      expect(mockMap.addSource).toHaveBeenCalledWith('network-liechtenstein', jasmine.any(Object));
      expect(mockService.getCoveredTrailsGeoJson).toHaveBeenCalledWith('NETWORK');
      expect(mockService.getCoverage).toHaveBeenCalledWith('NETWORK');
    });

    it('should route to loadSwitzerland for SWITZERLAND', () => {
      component.load('SWITZERLAND');
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-switzerland', jasmine.any(Object));
      expect(mockService.getCoveredTrailsGeoJson).toHaveBeenCalledWith('SWITZERLAND');
      expect(mockService.getCoverage).toHaveBeenCalledWith('SWITZERLAND');
    });

    it('should route to loadStGallen for STGALLEN', () => {
      component.load('STGALLEN');
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-stgallen', jasmine.any(Object));
      expect(mockService.getCoveredTrailsGeoJson).toHaveBeenCalledWith('STGALLEN');
      expect(mockService.getCoverage).toHaveBeenCalledWith('STGALLEN');
    });

    it('should route to loadGrisons for GRISONS', () => {
      component.load('GRISONS');
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-grisons', jasmine.any(Object));
      expect(mockService.getCoveredTrailsGeoJson).toHaveBeenCalledWith('GRISONS');
      expect(mockService.getCoverage).toHaveBeenCalledWith('GRISONS');
    });

    it('should route to loadTrailsHeatmap for TRAIL_HEATMAP', () => {
      component.load('TRAIL_HEATMAP');
      expect(mockService.getHeatmapGeoJson).toHaveBeenCalledWith('NETWORK');
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-heatmap', jasmine.any(Object));
    });

    it('should route to loadSummits for SUMMITS_LIECHTENSTEIN', () => {
      component.load('SUMMITS_LIECHTENSTEIN');
      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_LIECHTENSTEIN');
      expect(mockMap.flyTo).toHaveBeenCalled();
      expect(component.summitCoverage).toEqual(MOCK_SUMMIT_COVERAGE);
    });

    it('should route to loadSummits for SUMMITS_SWITZERLAND', () => {
      component.load('SUMMITS_SWITZERLAND');
      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_SWITZERLAND');
    });

    it('should route to loadSummits for SUMMITS_GRISONS', () => {
      component.load('SUMMITS_GRISONS');
      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_GRISONS');
    });
  });

  // -----------------------------------------------------------------------
  //  closeOverlay
  // -----------------------------------------------------------------------
  describe('closeOverlay', () => {
    it('should set showCoverage to false', () => {
      createComponentOnly();
      component.showCoverage = true;
      component.closeOverlay();
      expect(component.showCoverage).toBeFalse();
    });
  });

  // -----------------------------------------------------------------------
  //  Summit calculation (loadSummits)
  // -----------------------------------------------------------------------
  describe('loadSummits', () => {
    it('should render summit data on successful response', () => {
      createAndInit();
      component.load('SUMMITS_LIECHTENSTEIN');

      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_LIECHTENSTEIN');
      expect(component.isLoading).toBeFalse();
      expect(component.summitCoverage).toEqual(MOCK_SUMMIT_COVERAGE);
      expect(component.showCoverage).toBeTrue();

      expect(mockMap.addSource).toHaveBeenCalledWith(
        'summits-summits_liechtenstein',
        jasmine.objectContaining({type: 'geojson'})
      );

      const layerCalls = mockMap.addLayer.calls.all();
      const circleLayer = layerCalls.find((c: any) => c.args[0].type === 'circle');
      expect(circleLayer).toBeDefined();
      expect(circleLayer.args[0].id).toContain('-circles');
    });

    it('should handle null summit response gracefully', () => {
      mockService.getSummitCoverage.and.returnValue(of(null as any));
      createAndInit();

      component.load('SUMMITS_LIECHTENSTEIN');

      expect(component.isLoading).toBeFalse();
      expect(component.summitCoverage).toBeNull();
    });

    it('should handle error from getSummitCoverage gracefully', () => {
      mockService.getSummitCoverage.and.returnValue(throwError(() => new Error('API error')));
      createAndInit();

      component.load('SUMMITS_LIECHTENSTEIN');
      expect(component.isLoading).toBeFalse();
    });
  });

  // -----------------------------------------------------------------------
  //  Map click – combined handler
  // -----------------------------------------------------------------------
  describe('map click on covered trail layer', () => {
    let clickHandler: Function;

    /** Set up queryRenderedFeatures to return a covered-segment feature. */
    function setupCoveredFeature(rawFilenames: string) {
      mockMap.queryRenderedFeatures.and.callFake((_point: any, options: any) => {
        const layers: string[] = options?.layers ?? [];
        return layers.some((l: string) => l.endsWith('-covered'))
          ? [{properties: {filenames: rawFilenames}}]
          : [];
      });
    }

    beforeEach(() => {
      createAndInit();
      const loadHandler = eventHandlers['load'][0];
      loadHandler();
      // The combined click handler is at index 0
      clickHandler = eventHandlers['click'][0];
    });

    it('should show popup with sorted filenames', () => {
      setupCoveredFeature('["track/3","track/1","track/2"]');
      clickHandler({point: {x: 100, y: 200}, lngLat: {lng: 9.5, lat: 47.1}});

      expect(mockPopup.setLngLat).toHaveBeenCalledWith({lng: 9.5, lat: 47.1});
      expect(mockPopup.addTo).toHaveBeenCalledWith(mockMap);

      const html: string = mockPopup.setHTML.calls.mostRecent().args[0];
      expect(html).toContain('Activity 1');
      expect(html).toContain('Activity 2');
      expect(html).toContain('Activity 3');
      expect(html.indexOf('Activity 1')).toBeLessThan(html.indexOf('Activity 2'));
      expect(html.indexOf('Activity 2')).toBeLessThan(html.indexOf('Activity 3'));
    });

    it('should handle single filename', () => {
      setupCoveredFeature('["track/42"]');
      clickHandler({point: {x: 100, y: 200}, lngLat: {lng: 9.5, lat: 47.1}});

      const html: string = mockPopup.setHTML.calls.mostRecent().args[0];
      expect(html).toContain('Activity 42');
      expect(html).toContain('1 track');
    });

    it('should do nothing if no features at click point', () => {
      // Default queryRenderedFeatures returns []
      clickHandler({point: {x: 100, y: 200}, lngLat: {lng: 9.5, lat: 47.1}});
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });

    it('should handle JSON parse error in filenames', () => {
      setupCoveredFeature('{invalid json}');
      clickHandler({point: {x: 100, y: 200}, lngLat: {lng: 9.5, lat: 47.1}});
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });

    it('should handle non-array filenames', () => {
      setupCoveredFeature('"string_not_array"');
      clickHandler({point: {x: 100, y: 200}, lngLat: {lng: 9.5, lat: 47.1}});
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  //  Map click – summit popup
  // -----------------------------------------------------------------------
  describe('map click on summit circles', () => {
    let clickHandler: Function;

    beforeEach(() => {
      createAndInit();
      component.load('SUMMITS_LIECHTENSTEIN');
      expect(component.addedLayerIds.size).toBeGreaterThan(0);
      clickHandler = eventHandlers['click'][0];
    });

    it('should show summit popup when clicking on a summit feature', () => {
      mockMap.queryRenderedFeatures.and.callFake((_point: any, options: any) => {
        const layers: string[] = options?.layers ?? [];
        return layers.some((l: string) => l.endsWith('-circles'))
          ? [{properties: {name: 'Falknis', visits: 3}}]
          : [];
      });

      clickHandler(SUMMIT_CLICK_EVENT);

      expect(mockPopup.setHTML).toHaveBeenCalledWith('<strong>Falknis</strong><br>Besuche: 3');
      expect(mockPopup.setLngLat).toHaveBeenCalledWith({lng: 9.5, lat: 47.1});
      expect(mockPopup.addTo).toHaveBeenCalledWith(mockMap);
    });

    it('should do nothing when no circle layers exist', () => {
      component.addedLayerIds.clear();
      clickHandler(SUMMIT_CLICK_EVENT);
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });

    it('should do nothing when queryRenderedFeatures returns empty', () => {
      // Default returns []
      clickHandler(SUMMIT_CLICK_EVENT);
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  //  Coverage overlay rendering
  // -----------------------------------------------------------------------
  describe('template – coverage overlay', () => {
    it('should render coverage overlay when coverage exists', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = false;
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeTruthy();

      const ringValue = overlay.querySelector('.overlay__ring-value');
      expect(ringValue).toBeTruthy();
      expect(ringValue.textContent.trim()).toBe('45');
    });

    it('should render trail stats', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = false;
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.overlay');
      const statValues = overlay.querySelectorAll('.overlay__stat-value');
      expect(statValues.length).toBe(5); // km, trails, dist, elev, tracks
    });

    it('should not render overlay when showCoverage is false', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = false;
      component.isSummitRegion = false;
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeFalsy();
    });

    it('should render summit overlay instead of coverage overlay for summit regions', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = true;
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.querySelector('.overlay__ring-unit')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  //  Summit overlay rendering
  // -----------------------------------------------------------------------
  describe('template – summit overlay', () => {
    it('should render summit overlay when isSummitRegion and coverage', () => {
      createComponentOnly();
      component.isSummitRegion = true;
      component.showCoverage = true;
      component.summitCoverage = MOCK_SUMMIT_COVERAGE;
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeTruthy();

      const ringValue = overlay.querySelector('.overlay__ring-value');
      expect(ringValue).toBeTruthy();
      expect(ringValue.textContent.trim()).toBe('20');

      const summitItems = overlay.querySelectorAll('.overlay__summit-item');
      expect(summitItems.length).toBe(2);
      expect(summitItems[0].textContent).toContain('Falknis');
      expect(summitItems[1].textContent).toContain('Augstenberg');
    });

    it('should show recalculate button', () => {
      createComponentOnly();
      component.isSummitRegion = true;
      component.showCoverage = true;
      component.summitCoverage = MOCK_SUMMIT_COVERAGE;
      fixture.detectChanges();

      const refreshBtn = fixture.nativeElement.querySelector('.refresh-button');
      expect(refreshBtn).toBeTruthy();
    });

    it('should show no-data state when coverage is null', () => {
      createComponentOnly();
      component.isSummitRegion = true;
      component.showCoverage = true;
      component.summitCoverage = null;
      fixture.detectChanges();

      const emptyEl = fixture.nativeElement.querySelector('.overlay__empty');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toContain('Noch keine Gipfeldaten');
    });
  });

  // -----------------------------------------------------------------------
  //  Region selector dropdown (template)
  // -----------------------------------------------------------------------
  describe('template – region selector', () => {
    it('should show region groups in dropdown', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      fixture.detectChanges();

      const groups = fixture.nativeElement.querySelectorAll('.region-selector__group');
      expect(groups.length).toBe(4);
      expect(groups[0].textContent).toContain('Liechtenstein');
      expect(groups[1].textContent).toContain('Schweiz');
    });

    it('should show dropdown when showRegionDropdown is true', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector('.region-selector__dropdown');
      expect(dropdown).toBeTruthy();
    });

    it('should hide dropdown when showRegionDropdown is false', () => {
      createComponentOnly();
      component.showRegionDropdown = false;
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector('.region-selector__dropdown');
      expect(dropdown).toBeFalsy();
    });

    it('should highlight selected region option', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      component.selectedRegionValue = 'NETWORK';
      fixture.detectChanges();

      const selectedOption = fixture.nativeElement.querySelector('.region-selector__option.selected');
      expect(selectedOption).toBeTruthy();
      expect(selectedOption.textContent).toContain('Alle Strassen und Wege');
    });
  });

  // -----------------------------------------------------------------------
  //  Loading indicator (template)
  // -----------------------------------------------------------------------
  describe('template – loading indicator', () => {
    it('should show loading indicator when isLoading is true', () => {
      createComponentOnly();
      component.isLoading = true;
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('.loading-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator.textContent).toContain('Laden');
    });

    it('should hide loading indicator when isLoading is false', () => {
      createComponentOnly();
      component.isLoading = false;
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('.loading-indicator');
      expect(indicator).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  //  Close button (template)
  // -----------------------------------------------------------------------
  describe('template – close button', () => {
    it('should close overlay when close button is clicked', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = false;
      fixture.detectChanges();

      const closeBtn = fixture.nativeElement.querySelector('.close-button');
      expect(closeBtn).toBeTruthy();

      closeBtn.click();
      fixture.detectChanges();
      expect(component.showCoverage).toBeFalse();
    });
  });

  // -----------------------------------------------------------------------
  //  ngOnInit – backend version
  // -----------------------------------------------------------------------
  describe('ngOnInit', () => {
    it('should fetch backend version on init', () => {
      createAndInit('3.0.0-beta');
      expect(component.backendVersion).toBe('3.0.0-beta');
    });

    it('should show n/a on error', () => {
      mockService.getBackendVersion.and.returnValue(throwError(() => new Error('Server error')));
      createComponentOnly();
      fixture.detectChanges();
      expect(component.backendVersion).toBe('n/a');
    });
  });

  // -----------------------------------------------------------------------
  //  Version display in template
  // -----------------------------------------------------------------------
  describe('template – version info', () => {
    it('should display frontend and backend version in footer', () => {
      mockService.getBackendVersion.and.returnValue(of({backendVersion: '4.5.6'}));
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = false;
      component.frontendVersion = '1.2.3';
      fixture.detectChanges();

      const footer = fixture.nativeElement.querySelector('.overlay__footer');
      expect(footer).toBeTruthy();
      expect(footer.textContent).toContain('1.2.3');
      expect(footer.textContent).toContain('4.5.6');
    });
  });
});
