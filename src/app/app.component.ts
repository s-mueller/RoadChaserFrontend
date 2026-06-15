import {AfterViewInit, Component, HostListener, OnInit} from '@angular/core';
import {NgxMapLibreGLModule} from 'ngx-maplibre-gl';
import maplibregl from 'maplibre-gl';
import { HttpClient } from '@angular/common/http';
import {RoadChaserService} from './roadchaser.service';
import {DatePipe, DecimalPipe, NgIf, NgFor} from '@angular/common';
import {CoverageDto} from './model';
import {environment} from '../environments/environment';

interface RegionOption {
  value: string;
  label: string;
  group: string;
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
  coverage: CoverageDto;
  loadedSources: string[] = [];
  addedLayerIds: Set<string> = new Set();
  showCoverage = true;
  frontendVersion = environment.appVersion;
  backendVersion = '…';

  regionGroups = [
    { name: 'Liechtenstein', regions: [
      { value: 'WANDERWEG', label: 'Wanderwege (Liechtenstein)' },
      { value: 'NETWORK', label: 'Alle Strassen und Wege (Liechtenstein)' }
    ]},
    { name: 'Schweiz', regions: [
      { value: 'SWITZERLAND', label: 'Schweiz (gesamt)' },
      { value: 'STGALLEN', label: 'St. Gallen' },
      { value: 'GRISONS', label: 'Graubünden' }
    ]},
    { name: 'Special', regions: [
      { value: 'TRAIL_HEATMAP', label: 'Heatmap' }
    ]}
  ];
  
  selectedRegionValue = 'WANDERWEG';
  showRegionDropdown = false;

  constructor(private service: RoadChaserService, private http: HttpClient) {}

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
    this.load({ value: `'${value}'` } as any);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showRegionDropdown = false;
  }

  ngOnInit(): void {
    this.http.get<{ backendVersion: string }>(this.service.apiUrl + '/version').subscribe({
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
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      })
    );


    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false
    });

    this.map.on('click', 'trails-covered', (e) => {
      this.map.getCanvas().style.cursor = 'pointer';

      const feature = e.features?.[0];
      if (!feature) return;

      const rawFilenames = feature.properties?.['filenames'];
      let filenames: string[];

      try {
        filenames = typeof rawFilenames === 'string' ? JSON.parse(rawFilenames) : rawFilenames;
      } catch (err) {
        console.warn('Failed to parse filenames:', rawFilenames);
        return;
      }

      if (!Array.isArray(filenames)) {
        console.warn('Filenames is not an array:', filenames);
        return;
      }
      const sortedFilenames = [...filenames].sort((a, b) => {
        const idA = parseInt(a.split('/').pop() || '', 10);
        const idB = parseInt(b.split('/').pop() || '', 10);
        return idA - idB;
      });

      const html = `
  <strong>Covered by ${sortedFilenames.length} track${sortedFilenames.length !== 1 ? 's' : ''}:</strong><br>
  <div style="max-height: 150px; overflow-y: auto;">
    ${sortedFilenames.map(url => {
        const activityId = url.split('/').pop();
        return `<a href="${url}" target="_blank">Activity ${activityId}</a>`;
      }).join('<br>')}
  </div>
`;





      popup
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(this.map);
    });







    this.map.on('load', () => {
      this.loadTrails();
/**
      this.map.addSource('trail-heatmap', {
        type: 'geojson',
        data: 'assets/heatmap.json'
      });

      this.map.addLayer({
        id: 'trail-heatmap-layer',
        type: 'line',
        source: 'trail-heatmap',
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'intersection_count'],
            1, '#00ff00',
            5, '#ffff00',
            10, '#ff0000'
          ],
          'line-width': 3
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
      });
**/
    });
  }

  private loadNetwork() {
    this.removeExistingLayers();

    if (!this.loadedSources.includes('network-liechtenstein')) {
      this.map.addSource('network-liechtenstein', {
        type: 'vector',
        tiles: [this.service.tileBaseUrl + '/tiles/NETWORK/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });
      this.loadedSources.push('network-liechtenstein');
    }

    this.map.addLayer({
      id: 'network-liechtenstein',
      type: 'line',
      source: 'network-liechtenstein',
      'source-layer': 'network_liechtenstein',
      paint: {
        'line-color': '#ff6600',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.5,
          10, 1.5,
          14, 3
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.4,
          10, 0.7,
          14, 1
        ],
        'line-blur': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1.5,
          10, 0.5,
          14, 0
        ]
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      }
    });
    this.addedLayerIds.add('network-liechtenstein');

    this.http.get(this.service.apiUrl + "/data-result/NETWORK").subscribe((geojson: any) => {
      if (!geojson) return;
      if (!this.loadedSources.includes('network-covered')) {
        this.map.addSource('network-covered', {
          type: 'geojson',
          data: geojson
        });
        this.loadedSources.push('network-covered');
      }

      this.map.addLayer({
        id: 'network-covered',
        type: 'line',
        source: 'network-covered',
        paint: {
          'line-color': '#006600',
          'line-width': 3
        }
      });
      this.addedLayerIds.add('network-covered');
    })

    this.service.getCoverage("NETWORK").subscribe(response => {
      this.coverage = response;
    });

    this.map.setCenter([9.512414314597644, 47.165517853530986]);
  }

  private loadTrails() {
    this.removeExistingLayers();

    if (!this.loadedSources.includes('trails-liechtenstein')) {
      this.map.addSource('trails-liechtenstein', {
        type: 'vector',
        tiles: [this.service.tileBaseUrl + '/tiles/WANDERWEG/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });
      this.loadedSources.push('trails-liechtenstein');
    }

    this.map.addLayer({
      id: 'trails-liechtenstein',
      type: 'line',
      source: 'trails-liechtenstein',
      'source-layer': 'trails_liechtenstein',
      paint: {
        'line-color': '#ff6600',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.5,
          10, 1.5,
          14, 3
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.4,
          10, 0.7,
          14, 1
        ],
        'line-blur': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1.5,
          10, 0.5,
          14, 0
        ]
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      }
    });
    this.addedLayerIds.add('trails-liechtenstein');

    this.http.get(this.service.apiUrl + "/data-result/WANDERWEG").subscribe((geojson: any) => {
      if (!geojson) return;
      if (!this.loadedSources.includes('trails-covered')) {
        this.map.addSource('trails-covered', {
          type: 'geojson',
          data: geojson
        });
        this.loadedSources.push('trails-covered');
      }

      this.map.addLayer({
        id: 'trails-covered',
        type: 'line',
        source: 'trails-covered',
        paint: {
          'line-color': '#006600',
          'line-width': 3
        }
      });
      this.addedLayerIds.add('trails-covered');
    })



    this.service.getCoverage("WANDERWEG").subscribe(response => {
      this.coverage = response;
    });

    this.map.setCenter([9.512414314597644, 47.165517853530986]);
    this.map.setZoom(10.5);
  }

  private loadTrailsHeatmap() {
    this.removeExistingLayers();

    this.http.get(this.service.apiUrl + "/heatmap/NETWORK").subscribe((geojson: any) => {
      if (!geojson) return;
      if (!this.loadedSources.includes('trails-heatmap')) {
        this.map.addSource('trails-heatmap', {
          type: 'geojson',
          data: geojson
        });
        this.loadedSources.push('trails-heatmap');
      }

      this.map.addLayer({
        id: 'lines-heatmap',
        type: 'line',
        source: 'trails-heatmap',
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'intersection_count'],
            1, '#00ff00',     // Green
            50, '#ffff00',    // Yellow
            100, '#ff0000'    // Red
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0.5,
            10, 2,
            15, 6
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0.3,
            10, 0.6,
            15, 1
          ]
        }
      });
      this.addedLayerIds.add('lines-heatmap');


    })

    this.map.setCenter([9.512414314597644, 47.165517853530986]);
    this.map.setZoom(10.5);
  }


  private loadSwitzerland() {
    this.removeExistingLayers();

    if (!this.loadedSources.includes('trails-switzerland')) {
      this.map.addSource('trails-switzerland', {
        type: 'vector',
        tiles: [this.service.tileBaseUrl + '/tiles/SWITZERLAND/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });
      this.loadedSources.push('trails-switzerland');
    }

    this.map.addLayer({
      id: 'trails-switzerland',
      type: 'line',
      source: 'trails-switzerland',
      'source-layer': 'trails_switzerland',
      paint: {
        'line-color': '#ff6600',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.5,
          10, 1.5,
          14, 3
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.4,
          10, 0.7,
          14, 1
        ],
        'line-blur': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1.5,
          10, 0.5,
          14, 0
        ]
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      }
    });
    this.addedLayerIds.add('trails-switzerland');

    this.http.get(this.service.apiUrl + "/data-result/SWITZERLAND").subscribe((geojson: any) => {
      if (!geojson) return;
      if (!this.loadedSources.includes('switzerland-covered')) {
        this.map.addSource('switzerland-covered', {
          type: 'geojson',
          data: geojson
        });
        this.loadedSources.push('switzerland-covered');
      }

      this.map.addLayer({
        id: 'switzerland-covered',
        type: 'line',
        source: 'switzerland-covered',
        paint: {
          'line-color': '#006600',
          'line-width': 3
        }
      });
      this.addedLayerIds.add('switzerland-covered');
    })

    this.service.getCoverage("SWITZERLAND").subscribe(response => {
      this.coverage = response;
    });

    this.map.setCenter([8.414885671372303, 46.76931689104032]);
    this.map.setZoom(7.7);
  }

  private loadStGallen() {
    this.removeExistingLayers();

    if (!this.loadedSources.includes('trails-stgallen')) {
      this.map.addSource('trails-stgallen', {
        type: 'vector',
        tiles: [this.service.tileBaseUrl + '/tiles/STGALLEN/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });
      this.loadedSources.push('trails-stgallen');
    }

    this.map.addLayer({
      id: 'trails-stgallen',
      type: 'line',
      source: 'trails-stgallen',
      'source-layer': 'trails_stgallen',
      paint: {
        'line-color': '#ff6600',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.5,
          10, 1.5,
          14, 3
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.4,
          10, 0.7,
          14, 1
        ],
        'line-blur': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1.5,
          10, 0.5,
          14, 0
        ]
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      }
    });
    this.addedLayerIds.add('trails-stgallen');

    this.http.get(this.service.apiUrl + "/data-result/STGALLEN").subscribe((geojson: any) => {
      if (!geojson) return;
      if (!this.loadedSources.includes('stgallen-covered')) {
        this.map.addSource('stgallen-covered', {
          type: 'geojson',
          data: geojson
        });
        this.loadedSources.push('stgallen-covered');
      }

      this.map.addLayer({
        id: 'stgallen-covered',
        type: 'line',
        source: 'stgallen-covered',
        paint: {
          'line-color': '#006600',
          'line-width': 3
        }
      });
      this.addedLayerIds.add('stgallen-covered');
    })

    this.service.getCoverage("STGALLEN").subscribe(response => {
      this.coverage = response;
    });

    this.map.setCenter([9.569950768098238, 47.24951226677899]);
    this.map.setZoom(9);
  }

  private loadGrisons() {
    this.removeExistingLayers();

    if (!this.loadedSources.includes('trails-grisons')) {
      this.map.addSource('trails-grisons', {
        type: 'vector',
        tiles: [this.service.tileBaseUrl + '/tiles/GRISONS/{z}/{x}/{y}.pbf'],
        minzoom: 0,
        maxzoom: 14
      });
      this.loadedSources.push('trails-grisons');
    }

    this.map.addLayer({
      id: 'trails-grisons',
      type: 'line',
      source: 'trails-grisons',
      'source-layer': 'trails_grisons',
      paint: {
        'line-color': '#ff6600',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.5,
          10, 1.5,
          14, 3
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0.4,
          10, 0.7,
          14, 1
        ],
        'line-blur': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1.5,
          10, 0.5,
          14, 0
        ]
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      }
    });
    this.addedLayerIds.add('trails-grisons');

    this.http.get(this.service.apiUrl + "/data-result/GRISONS").subscribe((geojson: any) => {
      if (!geojson) return;
      if (!this.loadedSources.includes('grisons-covered')) {
        this.map.addSource('grisons-covered', {
          type: 'geojson',
          data: geojson
        });
        this.loadedSources.push('grisons-covered');
      }

      this.map.addLayer({
        id: 'grisons-covered',
        type: 'line',
        source: 'grisons-covered',
        paint: {
          'line-color': '#006600',
          'line-width': 3
        }
      });
      this.addedLayerIds.add('grisons-covered');
    })

    this.service.getCoverage("GRISONS").subscribe(response => {
      this.coverage = response;
    });

    this.map.setCenter([9.569950768098238, 47.24951226677899]);
    this.map.setZoom(9);
  }

  private removeExistingLayers() {
    this.addedLayerIds.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });
    this.addedLayerIds.clear();
  }

  load(target: any) {
    switch (target.value) {
      case '\'SWITZERLAND\'': this.loadSwitzerland(); break;
      case '\'NETWORK\'': this.loadNetwork(); break;
      case '\'WANDERWEG\'': this.loadTrails(); break;
      case '\'STGALLEN\'': this.loadStGallen(); break;
      case '\'GRISONS\'': this.loadGrisons(); break;
      case '\'TRAIL_HEATMAP\'': this.loadTrailsHeatmap(); break;
    }
  }

  closeOverlay() {
    this.showCoverage = false;
  }

}
