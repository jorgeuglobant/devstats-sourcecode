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
  public currentDev;
  public currentDevName;
  constructor(private httpService: HttpClient) {

  }

  decryptData(password: string) {
    forkJoin([
      this.httpService.get('/assets/raw-data.json', { responseType: 'text' })
    ])
      .subscribe(rawData => {
        const data = CryptoJS.AES.decrypt(rawData[0], password.trim()).toString(CryptoJS.enc.Utf8);
        this.rawData = JSON.parse(data);
        this.currentSprintName = Object.keys(this.rawData)[0];
        this.currentSprint = this.rawData[this.currentSprintName];
        this.pickDev('Sprint Summary');
        this.decrypted = true;
      });
  }

  pickSprint(sprintName) {
    this.currentSprintName = sprintName;
    this.currentSprint = this.rawData[sprintName];
    if (this.currentSprint.devStats[this.currentDevName]) {
      this.pickDev(this.currentDevName);
    } else {
      this.pickDev('Sprint Summary');
    }
  }

  pickDev(devName) {
    this.currentDevName = devName;
    this.currentDev = this.rawData[this.currentSprintName].devStats[devName];
    this.updateData$.next();
    console.log(this.currentDev)
  }
}
