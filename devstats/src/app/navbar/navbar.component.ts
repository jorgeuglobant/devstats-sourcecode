import { Component } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { DevPickerService } from '../dev-picker.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  sprintList: string[] = []
  devWhiteList = [
    'Ivan Zinkevich',
    'Javier Elizalde Solis',
    'Jhonatan Caceres Acevedo',
    'Jonathan H. Fernández',
    'Juan Francisco Bielma Vargas',
    'Luis Lopez',
    'Roberto Roman',
    'Sergio Torres Santander',
    'Slava Gruzdov'
  ]

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(private breakpointObserver: BreakpointObserver, public picker: DevPickerService) {
    this.picker.updateData$.subscribe(() => {
      this.sprintList = Object.keys(this.picker.rawData).sort();
    })
  }

}
