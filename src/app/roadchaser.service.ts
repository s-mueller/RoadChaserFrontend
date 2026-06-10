import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CoverageDto} from './model';
import {environment} from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RoadChaserService {

  public apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCoverage(roadType: string): Observable<CoverageDto> {
    return this.http.get<CoverageDto>(`${this.apiUrl}/data/${roadType}`);
  }
}
