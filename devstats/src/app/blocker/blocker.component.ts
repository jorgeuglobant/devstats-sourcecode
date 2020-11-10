import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DevPickerService } from '../dev-picker.service';

@Component({
  selector: 'app-blocker',
  templateUrl: './blocker.component.html',
  styleUrls: ['./blocker.component.scss']
})
export class BlockerComponent implements OnInit, AfterViewInit {

  password: string;
  @ViewChild('passwordE') passwordE: ElementRef;

  constructor(public picker: DevPickerService) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.passwordE.nativeElement.focus();
  }

  accessData(): void {
    this.picker.decryptData(this.password);
  }

}
