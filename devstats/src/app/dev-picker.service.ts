import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Subject } from 'rxjs';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class DevPickerService {
  public rawData = {};
  public decrypted = false;
  public updateData$ = new Subject<void>()
  public currentSprint;
  public currentSprintName;
  constructor(private httpService: HttpClient) {

  }

  decryptData(password: string): void {
    forkJoin([
      this.httpService.get('/assets/raw-data.json', { responseType: 'text' })
    ])
      .subscribe(rawData => {
        const data = CryptoJS.AES.decrypt(rawData[0], password.trim()).toString(CryptoJS.enc.Utf8);
        this.rawData = JSON.parse(data);
        this.pickSprint(Object.keys(this.rawData)[0]);
        this.decrypted = true;
        console.log(this.currentSprint)
      });
  }

  pickSprint(sprintName): void {
    this.currentSprintName = sprintName;
    this.currentSprint = this.rawData[sprintName];
    this.updateData$.next();
  }
}
