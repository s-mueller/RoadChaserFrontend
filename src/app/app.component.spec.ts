import {TestBed, ComponentFixture} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {AppComponent} from './app.component';
import {RoadChaserService} from './roadchaser.service';
import {CoverageDto, SummitCoverageDto} from './model';
import {Observable, of, throwError} from 'rxjs';
import maplibregl from 'maplibre-gl';
import {By} from '@angular/platform-browser';

/**
 * Mock trail click event matching maplibregl's event shape.
 * The component reads e.features[0].properties.filenames,
 * parses it as JSON, sorts, and renders a popup.
 */
function makeTrailClickEvent(rawFilenames: string) {
  return {
    features: [{properties: {filenames: rawFilenames}}],
    lngLat: {lng: 9.5, lat: 47.1}
  };
}

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

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let mockService: jasmine.SpyObj<RoadChaserService>;
  let httpMock: HttpTestingController;
  let mockMap: any;
  let mockPopup: any;
  let eventHandlers: {[event: string]: Function[]};
  let mockCanvas: {style: {cursor: string}};

  /**
   * Create a mock Map object that captures all event listeners
   * and provides stubs for map operations.
   */
  function createMockMap() {
    eventHandlers = {};
    mockCanvas = {style: {cursor: ''}};

    const mockGeoJSONSource = jasmine.createSpyObj('GeoJSONSource', ['setData']);

    const map = jasmine.createSpyObj('Map', [
      'on', 'off', 'addSource', 'addLayer', 'getSource', 'getLayer',
      'removeLayer', 'flyTo', 'addControl', 'removeControl',
      'getCanvas', 'queryRenderedFeatures', 'getStyle', 'setStyle',
      'remove', 'resize', 'getCenter', 'getZoom', 'setCenter', 'setZoom',
      'isMoving', 'isLoaded', 'isSourceLoaded', 'loaded', 'dragPan',
      'getContainer', 'getBounds', 'fitBounds', 'panTo', 'zoomTo'
    ]);

    // Capture event listeners so tests can trigger them later
    map.on.and.callFake((event: string, ...args: any[]) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      // Last argument is always the callback
      eventHandlers[event].push(args[args.length - 1]);
    });

    map.getCanvas.and.returnValue(mockCanvas);
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
      'getCoverage', 'getSummitCoverage', 'calculateSummitCoverage'
    ]);
    mockService.apiUrl = '/api';
    mockService.tileBaseUrl = 'http://localhost/api';
    mockService.getCoverage.and.returnValue(of(MOCK_COVERAGE));
    mockService.getSummitCoverage.and.returnValue(of(MOCK_SUMMIT_COVERAGE));
    mockService.calculateSummitCoverage.and.returnValue(of(MOCK_SUMMIT_COVERAGE));
  }

  /** Create the component but DON'T call detectChanges (no lifecycle hooks). */
  function createComponentOnly() {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  }

  /** Create + detectChanges so ngOnInit and ngAfterViewInit fire. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function createAndInit(flushVersion: string = '1.0.0') {
    createComponentOnly();
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/version');
    req.flush({backendVersion: flushVersion});
  }

  beforeEach(async () => {
    mockMap = createMockMap();
    mockPopup = createMockPopup();

    // Spy on maplibregl constructors BEFORE component creation
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
      createComponentOnly();
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/version');
      req.flush('Network error', {status: 0, statusText: 'Unknown Error'});
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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

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
      expect(mockMap.on).toHaveBeenCalledWith('click', 'trails-covered', jasmine.any(Function));
      expect(mockMap.on).toHaveBeenCalledWith('click', jasmine.any(Function));
      expect(mockMap.on).toHaveBeenCalledWith('load', jasmine.any(Function));
    });

    it('should trigger loadTrails on map load event', () => {
      createAndInit();
      // The map 'load' handler was registered; trigger it
      const loadHandler = eventHandlers['load'][0];
      loadHandler();

      // loadTrails should be called which adds sources, layers, and fetches coverage
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-liechtenstein', jasmine.objectContaining({
        type: 'vector',
        minzoom: 0,
        maxzoom: 14
      }));

      // The component's http.get should fire for data-result/WANDERWEG
      const dataReq = httpMock.expectOne('/api/data-result/WANDERWEG');
      dataReq.flush({type: 'FeatureCollection', features: []});

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
      component.load({value: "'WANDERWEG'"});
      httpMock.expectOne('/api/data-result/WANDERWEG').flush({type: 'FeatureCollection', features: []});
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-liechtenstein', jasmine.any(Object));
      expect(mockService.getCoverage).toHaveBeenCalledWith('WANDERWEG');
    });

    it('should route to loadNetwork for NETWORK', () => {
      component.load({value: "'NETWORK'"});
      httpMock.expectOne('/api/data-result/NETWORK').flush({type: 'FeatureCollection', features: []});
      expect(mockMap.addSource).toHaveBeenCalledWith('network-liechtenstein', jasmine.any(Object));
      expect(mockService.getCoverage).toHaveBeenCalledWith('NETWORK');
    });

    it('should route to loadSwitzerland for SWITZERLAND', () => {
      component.load({value: "'SWITZERLAND'"});
      httpMock.expectOne('/api/data-result/SWITZERLAND').flush({type: 'FeatureCollection', features: []});
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-switzerland', jasmine.any(Object));
      expect(mockService.getCoverage).toHaveBeenCalledWith('SWITZERLAND');
    });

    it('should route to loadStGallen for STGALLEN', () => {
      component.load({value: "'STGALLEN'"});
      httpMock.expectOne('/api/data-result/STGALLEN').flush({type: 'FeatureCollection', features: []});
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-stgallen', jasmine.any(Object));
      expect(mockService.getCoverage).toHaveBeenCalledWith('STGALLEN');
    });

    it('should route to loadGrisons for GRISONS', () => {
      component.load({value: "'GRISONS'"});
      httpMock.expectOne('/api/data-result/GRISONS').flush({type: 'FeatureCollection', features: []});
      expect(mockMap.addSource).toHaveBeenCalledWith('trails-grisons', jasmine.any(Object));
      expect(mockService.getCoverage).toHaveBeenCalledWith('GRISONS');
    });

    it('should route to loadTrailsHeatmap for TRAIL_HEATMAP', () => {
      component.load({value: "'TRAIL_HEATMAP'"});

      // Trigger the pending HTTP request from the heatmap loader
      const dataReq = httpMock.expectOne('/api/heatmap/NETWORK');
      dataReq.flush({type: 'FeatureCollection', features: []});

      expect(mockMap.addSource).toHaveBeenCalledWith('trails-heatmap', jasmine.any(Object));
    });

    it('should route to loadSummits for SUMMITS_LIECHTENSTEIN', () => {
      component.load({value: "'SUMMITS_LIECHTENSTEIN'"});
      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_LIECHTENSTEIN');
      expect(mockMap.flyTo).toHaveBeenCalled();
      // isLoading is reset to false synchronously because mocked service returns of()
      // isSummitRegion is set by selectRegion(), not by load()
      expect(component.summitCoverage).toEqual(MOCK_SUMMIT_COVERAGE);
    });

    it('should route to loadSummits for SUMMITS_SWITZERLAND', () => {
      component.load({value: "'SUMMITS_SWITZERLAND'"});
      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_SWITZERLAND');
    });

    it('should route to loadSummits for SUMMITS_GRISONS', () => {
      component.load({value: "'SUMMITS_GRISONS'"});
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
  //  recalculateCurrentSummits
  // -----------------------------------------------------------------------
  describe('recalculateCurrentSummits', () => {
    it('should do nothing when not a summit region', () => {
      createComponentOnly();
      component.selectedRegionValue = 'WANDERWEG';
      component.recalculateCurrentSummits();
      expect(mockService.calculateSummitCoverage).not.toHaveBeenCalled();
    });

    it('should call calculateSummitCoverage for summit regions', () => {
      createAndInit();
      component.selectedRegionValue = 'SUMMITS_LIECHTENSTEIN';
      component.recalculateCurrentSummits();
      expect(mockService.calculateSummitCoverage).toHaveBeenCalledWith('SUMMITS_LIECHTENSTEIN');
    });

    it('should start loading when recalculating', () => {
      // Use a non-resolving observable so isLoading stays true
      mockService.calculateSummitCoverage.and.returnValue(new Observable(() => {}));
      createAndInit();
      component.selectedRegionValue = 'SUMMITS_LIECHTENSTEIN';
      component.recalculateCurrentSummits();
      expect(component.isLoading).toBeTrue();
      expect(mockService.calculateSummitCoverage).toHaveBeenCalledWith('SUMMITS_LIECHTENSTEIN');
    });
  });

  // -----------------------------------------------------------------------
  //  Summit calculation (loadSummits)
  // -----------------------------------------------------------------------
  describe('loadSummits', () => {
    it('should render summit data on successful response', () => {
      createAndInit();
      component.load({value: "'SUMMITS_LIECHTENSTEIN'"});

      // isLoading is already false because mocked service returns of() synchronously
      expect(mockService.getSummitCoverage).toHaveBeenCalledWith('SUMMITS_LIECHTENSTEIN');

      // Verify summit data is rendered
      expect(component.isLoading).toBeFalse();
      expect(component.summitCoverage).toEqual(MOCK_SUMMIT_COVERAGE);
      expect(component.showCoverage).toBeTrue();

      // Map should have a new GeoJSON source for summits
      // sourceId = 'summits-' + region.toLowerCase() = 'summits-summits_liechtenstein'
      expect(mockMap.addSource).toHaveBeenCalledWith(
        'summits-summits_liechtenstein',
        jasmine.objectContaining({type: 'geojson'})
      );

      // And a circle layer for markers
      const layerCalls = mockMap.addLayer.calls.all();
      const circleLayer = layerCalls.find((c: any) => c.args[0].type === 'circle');
      expect(circleLayer).toBeDefined();
      expect(circleLayer.args[0].id).toContain('-circles');
    });

    it('should handle null summit response gracefully', () => {
      mockService.getSummitCoverage.and.returnValue(of(null as any));
      createAndInit();

      component.load({value: "'SUMMITS_LIECHTENSTEIN'"});

      expect(component.isLoading).toBeFalse();
      expect(component.summitCoverage).toBeNull();
    });

    it('should handle error from getSummitCoverage gracefully', () => {
      mockService.getSummitCoverage.and.returnValue(throwError(() => new Error('API error')));
      createAndInit();

      component.load({value: "'SUMMITS_LIECHTENSTEIN'"});
      expect(component.isLoading).toBeFalse();
    });
  });

  // -----------------------------------------------------------------------
  //  Map click – trail coverage popup
  // -----------------------------------------------------------------------
  describe('map click on trails-covered layer', () => {
    beforeEach(() => {
      createAndInit();
      // Trigger load event so loadTrails() adds the 'trails-covered' layer
      const loadHandler = eventHandlers['load'][0];
      loadHandler();
      httpMock.expectOne('/api/data-result/WANDERWEG').flush({
        type: 'FeatureCollection', features: []
      });
    });

    it('should show popup with sorted filenames', () => {
      const clickHandler = eventHandlers['click'][0];
      clickHandler(makeTrailClickEvent('["track/3","track/1","track/2"]'));

      expect(mockPopup.setLngLat).toHaveBeenCalledWith({lng: 9.5, lat: 47.1});
      expect(mockPopup.addTo).toHaveBeenCalledWith(mockMap);

      // HTML should contain links sorted numerically
      const setHTMLCall = mockPopup.setHTML.calls.mostRecent();
      const html: string = setHTMLCall.args[0];
      expect(html).toContain('Activity 1');
      expect(html).toContain('Activity 2');
      expect(html).toContain('Activity 3');
      // Check order (Activity 1 before Activity 2 before Activity 3)
      expect(html.indexOf('Activity 1')).toBeLessThan(html.indexOf('Activity 2'));
      expect(html.indexOf('Activity 2')).toBeLessThan(html.indexOf('Activity 3'));
    });

    it('should handle single filename', () => {
      const clickHandler = eventHandlers['click'][0];
      clickHandler(makeTrailClickEvent('["track/42"]'));

      const html: string = mockPopup.setHTML.calls.mostRecent().args[0];
      expect(html).toContain('Activity 42');
      expect(html).toContain('1 track');
    });

    it('should do nothing if no features in click event', () => {
      const clickHandler = eventHandlers['click'][0];
      clickHandler({lngLat: {lng: 9.5, lat: 47.1}});
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });

    it('should handle JSON parse error in filenames', () => {
      const clickHandler = eventHandlers['click'][0];
      clickHandler(makeTrailClickEvent('{invalid json}'));
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });

    it('should handle non-array filenames', () => {
      const clickHandler = eventHandlers['click'][0];
      clickHandler(makeTrailClickEvent('"string_not_array"'));
      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  //  Map click – summit popup
  // -----------------------------------------------------------------------
  describe('map click on summit circles', () => {
    beforeEach(() => {
      createAndInit();
      // Load summit data so '-circles' layers are present
      component.load({value: "'SUMMITS_LIECHTENSTEIN'"});
      expect(component.addedLayerIds.size).toBeGreaterThan(0);
    });

    it('should show summit popup when clicking on a summit feature', () => {
      mockMap.queryRenderedFeatures.and.returnValue([{
        properties: {name: 'Falknis', visits: 3}
      }]);

      const summitHandler = eventHandlers['click'][1];
      summitHandler(SUMMIT_CLICK_EVENT);

      expect(mockPopup.setHTML).toHaveBeenCalledWith('<strong>Falknis</strong><br>Besuche: 3');
      expect(mockPopup.setLngLat).toHaveBeenCalledWith({lng: 9.5, lat: 47.1});
      expect(mockPopup.addTo).toHaveBeenCalledWith(mockMap);
    });

    it('should do nothing when no circle layers exist', () => {
      // Clear all added layer IDs
      component.addedLayerIds.clear();

      const summitHandler = eventHandlers['click'][1];
      summitHandler(SUMMIT_CLICK_EVENT);

      expect(mockPopup.setHTML).not.toHaveBeenCalled();
    });

    it('should do nothing when queryRenderedFeatures returns empty', () => {
      mockMap.queryRenderedFeatures.and.returnValue([]);

      const summitHandler = eventHandlers['click'][1];
      summitHandler(SUMMIT_CLICK_EVENT);

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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeTruthy();

      // Check ring value displays coverage percentage
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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeFalsy();
    });

    it('should render summit overlay instead of coverage overlay for summit regions', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = true;
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      // The overlay IS rendered (summit overlay uses same .overlay class)
      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeTruthy();
      // But coverage stats (rendered by coverage overlay path) should NOT be present
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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const overlay = fixture.nativeElement.querySelector('.overlay');
      expect(overlay).toBeTruthy();

      // Should show visited count
      const ringValue = overlay.querySelector('.overlay__ring-value');
      expect(ringValue).toBeTruthy();
      expect(ringValue.textContent.trim()).toBe('20');

      // Should show summit names in the list
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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const refreshBtn = fixture.nativeElement.querySelector('.refresh-button');
      expect(refreshBtn).toBeTruthy();
    });

    it('should show no-data state when coverage is null', () => {
      createComponentOnly();
      component.isSummitRegion = true;
      component.showCoverage = true;
      component.summitCoverage = null;
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const groups = fixture.nativeElement.querySelectorAll('.region-selector__group');
      expect(groups.length).toBe(4);
      expect(groups[0].textContent).toContain('Liechtenstein');
      expect(groups[1].textContent).toContain('Schweiz');
    });

    it('should show dropdown when showRegionDropdown is true', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const dropdown = fixture.nativeElement.querySelector('.region-selector__dropdown');
      expect(dropdown).toBeTruthy();
    });

    it('should hide dropdown when showRegionDropdown is false', () => {
      createComponentOnly();
      component.showRegionDropdown = false;
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const dropdown = fixture.nativeElement.querySelector('.region-selector__dropdown');
      expect(dropdown).toBeFalsy();
    });

    it('should highlight selected region option', () => {
      createComponentOnly();
      component.showRegionDropdown = true;
      component.selectedRegionValue = 'NETWORK';
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

      const indicator = fixture.nativeElement.querySelector('.loading-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator.textContent).toContain('Laden');
    });

    it('should hide loading indicator when isLoading is false', () => {
      createComponentOnly();
      component.isLoading = false;
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

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
      httpMock.expectOne('/api/version').flush({backendVersion: '1'});

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
      createComponentOnly();
      fixture.detectChanges();

      const req = httpMock.expectOne('/api/version');
      req.flush('Server error', {status: 500, statusText: 'Server Error'});

      expect(component.backendVersion).toBe('n/a');
    });
  });

  // -----------------------------------------------------------------------
  //  Version display in template
  // -----------------------------------------------------------------------
  describe('template – version info', () => {
    it('should display frontend and backend version in footer', () => {
      createComponentOnly();
      component.coverage = MOCK_COVERAGE;
      component.showCoverage = true;
      component.isSummitRegion = false;
      component.frontendVersion = '1.2.3';
      component.backendVersion = '4.5.6';
      fixture.detectChanges();
      httpMock.expectOne('/api/version').flush({backendVersion: '4.5.6'});

      const footer = fixture.nativeElement.querySelector('.overlay__footer');
      expect(footer).toBeTruthy();
      expect(footer.textContent).toContain('1.2.3');
      expect(footer.textContent).toContain('4.5.6');
    });
  });
});
