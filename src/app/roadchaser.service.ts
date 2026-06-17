import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CoverageDto, SummitCoverageDto} from './model';
import {environment} from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RoadChaserService {

  public apiUrl = environment.apiUrl;
  public tileBaseUrl = environment.apiUrl.startsWith('http')
    ? environment.apiUrl
    : window.location.origin + environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCoverage(roadType: string): Observable<CoverageDto> {
    return this.http.get<CoverageDto>(`${this.apiUrl}/data/${roadType}`);
  }

  getSummitCoverage(region: string): Observable<SummitCoverageDto> {
    return this.http.get<SummitCoverageDto>(`${this.apiUrl}/summits/${region}`);
  }

  calculateSummitCoverage(region: string): Observable<SummitCoverageDto> {
    return this.http.post<SummitCoverageDto>(`${this.apiUrl}/summits/recalculate/${region}`, {});
  }
}
