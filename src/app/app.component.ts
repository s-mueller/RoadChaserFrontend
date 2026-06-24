import {AfterViewInit, Component, HostListener, OnInit} from '@angular/core';
import {NgxMapLibreGLModule} from 'ngx-maplibre-gl';
import maplibregl from 'maplibre-gl';
import {RoadChaserService} from './roadchaser.service';
import {DatePipe, DecimalPipe, NgIf, NgFor} from '@angular/common';
import {CoverageDto, SummitCoverageDto} from './model';
import {environment} from '../environments/environment';

interface TrailRegionConfig {
  tileSourceId: string;
  tileSourceLayer: string;
  tileLayerId: string;
  coveredSourceId: string;
  coveredLayerId: string;
  apiRegion: string;
  center: [number, number];
  zoom: number;
}

@Component({
  selector: 'app-root',
  imports: [NgxMapLibreGLModule, NgIf, NgFor, DecimalPipe, DatePipe],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnInit {
  map!: maplibregl.Map;
  coverage: CoverageDto | null = null;
  summitCoverage: SummitCoverageDto | null = null;
  isSummitRegion = false;
  loadedSources: string[] = [];
  addedLayerIds: Set<string> = new Set();
  showCoverage = true;
  isLoading = false;
  frontendVersion = environment.appVersion;
  backendVersion = '…';

  regionGroups = [
    { name: 'Liechtenstein', regions: [
      { value: 'WANDERWEG', label: 'Wanderwege' },
      { value: 'NETWORK', label: 'Alle Strassen und Wege' },
      { value: 'SUMMITS_LIECHTENSTEIN', label: 'Gipfel' },
      { value: 'TRAIL_HEATMAP', label: 'Heatmap' }
    ]},
    { name: 'Schweiz', regions: [
      { value: 'SWITZERLAND', label: 'Wanderwege' },
      { value: 'SUMMITS_SWITZERLAND', label: 'Gipfel' }
    ]},
    { name: 'St. Gallen', regions: [
      { value: 'STGALLEN', label: 'Wanderwege' },
      { value: 'SUMMITS_STGALLEN', label: 'Gipfel' }
    ]},
    { name: 'Graubünden', regions: [
      { value: 'GRISONS', label: 'Wanderwege' },
      { value: 'SUMMITS_GRISONS', label: 'Gipfel' }
    ]}
  ];

  private readonly trailRegionConfigs: Record<string, TrailRegionConfig> = {
    WANDERWEG: {
      tileSourceId: 'trails-liechtenstein', tileSourceLayer: 'trails_liechtenstein', tileLayerId: 'trails-liechtenstein',
      coveredSourceId: 'trails-covered', coveredLayerId: 'trails-covered',
      apiRegion: 'WANDERWEG', center: [9.512414314597644, 47.165517853530986], zoom: 10.5,
    },
    NETWORK: {
      tileSourceId: 'network-liechtenstein', tileSourceLayer: 'network_liechtenstein', tileLayerId: 'network-liechtenstein',
      coveredSourceId: 'network-covered', coveredLayerId: 'network-covered',
      apiRegion: 'NETWORK', center: [9.512414314597644, 47.165517853530986], zoom: 10.5,
    },
    SWITZERLAND: {
      tileSourceId: 'trails-switzerland', tileSourceLayer: 'trails_switzerland', tileLayerId: 'trails-switzerland',
      coveredSourceId: 'switzerland-covered', coveredLayerId: 'switzerland-covered',
      apiRegion: 'SWITZERLAND', center: [8.414885671372303, 46.76931689104032], zoom: 7.7,
    },
    STGALLEN: {
      tileSourceId: 'trails-stgallen', tileSourceLayer: 'trails_stgallen', tileLayerId: 'trails-stgallen',
      coveredSourceId: 'stgallen-covered', coveredLayerId: 'stgallen-covered',
      apiRegion: 'STGALLEN', center: [9.569950768098238, 47.24951226677899], zoom: 9,
    },
    GRISONS: {
      tileSourceId: 'trails-grisons', tileSourceLayer: 'trails_grisons', tileLayerId: 'trails-grisons',
      coveredSourceId: 'grisons-covered', coveredLayerId: 'grisons-covered',
      apiRegion: 'GRISONS', center: [9.5, 46.7], zoom: 9.5,
    },
  };

  private readonly summitRegionConfigs: Record<string, { center: [number, number]; zoom: number }> = {
    SUMMITS_LIECHTENSTEIN: { center: [9.512414314597644, 47.165517853530986], zoom: 10.5 },
    SUMMITS_SWITZERLAND:   { center: [8.414885671372303, 46.76931689104032], zoom: 7.7 },
    SUMMITS_STGALLEN:      { center: [9.569950768098238, 47.24951226677899], zoom: 9 },
    SUMMITS_GRISONS:       { center: [9.5, 46.7], zoom: 9.5 },
  };

  selectedRegionValue = 'WANDERWEG';
  showRegionDropdown = false;

  constructor(private service: RoadChaserService) {}

  get selectedRegionLabel(): string {
    for (const group of this.regionGroups) {
      const found = group.regions.find(r => r.value === this.selectedRegionValue);
      if (found) return found.label;
    }
    return this.selectedRegionValue;
  }

  toggleRegionDropdown(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.showRegionDropdown = !this.showRegionDropdown;
  }

  selectRegion(value: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedRegionValue = value;
    this.showRegionDropdown = false;
    this.isSummitRegion = value.startsWith('SUMMITS_');
    this.showCoverage = true;
    this.load(value);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showRegionDropdown = false;
  }

  ngOnInit(): void {
    this.service.getBackendVersion().subscribe({
      next: (res) => this.backendVersion = res.backendVersion,
      error: () => this.backendVersion = 'n/a'
    });
  }

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: 'map',
      style: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json',
      center: [9.512414314597644, 47.165517853530986],
      zoom: 11,
      maxZoom: 14
    });

    this.map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true
      })
    );

    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false });

    this.map.on('click', (e) => {
      // Covered trail segments — show Strava activity links
      const coveredLayers = Array.from(this.addedLayerIds).filter(id => id.endsWith('-covered'));
      if (coveredLayers.length > 0) {
        const features = this.map.queryRenderedFeatures(e.point, { layers: coveredLayers });
        if (features.length > 0) {
          const rawFilenames = features[0].properties?.['filenames'];
          let filenames: string[];
          try {
            filenames = typeof rawFilenames === 'string' ? JSON.parse(rawFilenames) : rawFilenames;
          } catch {
            return;
          }
          if (!Array.isArray(filenames)) return;

          const sorted = [...filenames].sort((a, b) => {
            const idA = parseInt(a.split('/').pop() || '', 10);
            const idB = parseInt(b.split('/').pop() || '', 10);
            return idA - idB;
          });

          popup
            .setLngLat(e.lngLat)
            .setHTML(`
              <strong>Covered by ${sorted.length} track${sorted.length !== 1 ? 's' : ''}:</strong><br>
              <div style="max-height:150px;overflow-y:auto">
                ${sorted.map(url => `<a href="${url}" target="_blank">Activity ${url.split('/').pop()}</a>`).join('<br>')}
              </div>`)
            .addTo(this.map);
          return;
        }
      }

      // Summit markers — show name and visit count
      const summitLayers = Array.from(this.addedLayerIds).filter(id => id.endsWith('-circles'));
      if (summitLayers.length > 0) {
        const features = this.map.queryRenderedFeatures(e.point, { layers: summitLayers });
        if (features.length > 0) {
          popup
            .setLngLat(e.lngLat)
            .setHTML(`<strong>${features[0].properties?.['name']}</strong><br>Besuche: ${features[0].properties?.['visits']}`)
            .addTo(this.map);
        }
      }
    });

    this.map.on('load', () => {
      this.loadTrailRegion(this.trailRegionConfigs['WANDERWEG']);
    });
  }

  load(value: string): void {
    const trailConfig = this.trailRegionConfigs[value];
    if (trailConfig) { this.loadTrailRegion(trailConfig); return; }

    if (value === 'TRAIL_HEATMAP') { this.loadTrailsHeatmap(); return; }

    const summitConfig = this.summitRegionConfigs[value];
    if (summitConfig) { this.loadSummits(value, summitConfig.center, summitConfig.zoom); }
  }

  private loadTrailRegion(config: TrailRegionConfig): void {
    this.removeExistingLayers();
    this.isLoading = true;

    if (!this.loadedSources.includes(config.tileSourceId)) {
      this.map.addSource(config.tileSourceId, {
        type: 'vector',
        tiles: [`${this.service.tileBaseUrl}/tiles/${config.apiRegion}/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 14
      });
      this.loadedSources.push(config.tileSourceId);
    }

    this.map.addLayer({
      id: config.tileLayerId,
      type: 'line',
      source: config.tileSourceId,
      'source-layer': config.tileSourceLayer,
      paint: {
        'line-color': '#ff6600',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.3, 10, 1, 14, 2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 0.7, 14, 1],
      },
      layout: { 'line-join': 'round', 'line-cap': 'round' }
    });
    this.addedLayerIds.add(config.tileLayerId);

    this.service.getCoveredTrailsGeoJson(config.apiRegion).subscribe({
      next: (geojson: any) => {
        this.isLoading = false;
        if (!geojson) return;
        if (!this.loadedSources.includes(config.coveredSourceId)) {
          this.map.addSource(config.coveredSourceId, { type: 'geojson', data: geojson });
          this.loadedSources.push(config.coveredSourceId);
        } else {
          (this.map.getSource(config.coveredSourceId) as maplibregl.GeoJSONSource).setData(geojson);
        }
        if (!this.map.getLayer(config.coveredLayerId)) {
          this.map.addLayer({
            id: config.coveredLayerId,
            type: 'line',
            source: config.coveredSourceId,
            paint: { 'line-color': '#006600', 'line-width': 3 }
          });
        }
        this.addedLayerIds.add(config.coveredLayerId);
      },
      error: () => { this.isLoading = false; }
    });

    this.service.getCoverage(config.apiRegion).subscribe({
      next: (response) => { this.coverage = response; },
      error: () => {}
    });

    this.map.flyTo({ center: config.center, zoom: config.zoom, duration: 1200 });
  }

  private loadTrailsHeatmap(): void {
    this.removeExistingLayers();
    this.isLoading = true;

    this.service.getHeatmapGeoJson('NETWORK').subscribe({
      next: (geojson: any) => {
        this.isLoading = false;
        if (!geojson) return;
        if (!this.loadedSources.includes('trails-heatmap')) {
          this.map.addSource('trails-heatmap', { type: 'geojson', data: geojson });
          this.loadedSources.push('trails-heatmap');
        } else {
          (this.map.getSource('trails-heatmap') as maplibregl.GeoJSONSource).setData(geojson);
        }
        if (!this.map.getLayer('lines-heatmap')) {
          this.map.addLayer({
            id: 'lines-heatmap',
            type: 'line',
            source: 'trails-heatmap',
            paint: {
              'line-color': [
                'interpolate', ['linear'], ['get', 'intersection_count'],
                1, '#4a90d9', 25, '#7c5bbf', 50, '#9b59b6', 75, '#d63384', 100, '#e91e63'
              ],
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 2, 15, 6],
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 10, 0.6, 15, 1]
            }
          });
        }
        this.addedLayerIds.add('lines-heatmap');
      },
      error: () => { this.isLoading = false; }
    });

    this.map.flyTo({ center: [9.512414314597644, 47.165517853530986], zoom: 10.5, duration: 1200 });
  }

  private loadSummits(region: string, center: [number, number], zoom: number): void {
    this.removeExistingLayers();
    this.isLoading = true;
    this.summitCoverage = null;

    this.service.getSummitCoverage(region).subscribe({
      next: (response) => {
        if (response) this.renderSummitData(region, response);
        else this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });

    this.map.flyTo({ center, zoom, duration: 1200 });
  }

  recalculateCurrentSummits(): void {
    if (!this.selectedRegionValue.startsWith('SUMMITS_')) return;
    this.isLoading = true;
    this.service.calculateSummitCoverage(this.selectedRegionValue).subscribe({
      next: (response) => {
        if (response) this.renderSummitData(this.selectedRegionValue, response);
        else this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  private renderSummitData(region: string, response: SummitCoverageDto): void {
    this.summitCoverage = response;
    this.isLoading = false;
    this.showCoverage = true;

    const geojson: any = {
      type: 'FeatureCollection',
      features: response.summitDetails.map(s => ({
        type: 'Feature',
        properties: { name: s.name, visits: s.visits },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] }
      }))
    };

    const sourceId = 'summits-' + region.toLowerCase();
    const layerId = sourceId + '-circles';

    if (!this.loadedSources.includes(sourceId)) {
      this.map.addSource(sourceId, { type: 'geojson', data: geojson });
      this.loadedSources.push(sourceId);
    } else {
      (this.map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
    }

    if (!this.map.getLayer(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'visits'], 0], 5, 8],
          'circle-color': ['case', ['==', ['get', 'visits'], 0], '#ff6600', '#006600'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });
      this.addedLayerIds.add(layerId);
    }
  }

  closeOverlay(): void {
    this.showCoverage = false;
  }

  private removeExistingLayers(): void {
    this.addedLayerIds.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });
    this.addedLayerIds.clear();
  }
}
