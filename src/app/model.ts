export class CoverageDto {
  coverage: number;
  totalTrailLength: number;
  numberOfTracksChecked: number;
  numberOfTrailsChecked: number;
  lastCalculated: string;
  lastSyncedWithStrava: string;
  totalElevationGain: number;
  totalDistance: number;
}

export interface SummitDetail {
  name: string;
  visits: number;
  lat: number;
  lon: number;
  uuid: string;
}

export class SummitCoverageDto {
  totalSummits: number;
  visitedSummits: number;
  totalVisits: number;
  summitDetails: SummitDetail[];
  lastCalculated: string;
  lastSyncedWithStrava: string;
}
