import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { map } from 'rxjs/operators';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { DevPickerService } from '../dev-picker.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  /** Based on the screen size, switch from standard to one column per row */
  cards = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map(({ matches }) => {
      if (matches) {
        return [
          { title: 'Card 1', cols: 1, rows: 1 },
          { title: 'Card 2', cols: 1, rows: 1 },
          { title: 'Card 3', cols: 1, rows: 1 },
          { title: 'Card 4', cols: 1, rows: 1 }
        ];
      }

      return [
        { title: 'Card 1', cols: 2, rows: 1 },
        { title: 'Card 2', cols: 1, rows: 1 },
        { title: 'Card 3', cols: 1, rows: 2 },
        { title: 'Card 4', cols: 1, rows: 1 }
      ];
    })
  );
  
  @ViewChild(MatSort) sort: MatSort;

  constructor(private breakpointObserver: BreakpointObserver, public picker: DevPickerService) {}

  ngOnInit(): void{
    this.picker.updateData$.subscribe(() => {
      this.picker.currentDev.timeTrackedDS = new MatTableDataSource(this.picker.currentDev.timeTracked);
      this.picker.currentDev.timeTrackedDS.sort = this.sort;
      this.picker.currentDev.summary.totalStories = [
      ...new Set (this.picker.currentDev.timeTracked.filter(tt => tt.type === 'Story' || tt.parentType === 'Story').map(a => a.id))
      ].length;
      this.picker.currentDev.summary.totalStoriesDevToPr = this.picker.currentDev.devToPr.length;
      this.picker.currentDev.summary.totalBugs = this.picker.currentSprint.bugStats.invalid.length +
       this.picker.currentSprint.bugStats.valid.length + this.picker.currentSprint.bugStats.uncategorized.length;
      this.picker.currentDev.summary.totalOthers = 
      [
      ...new Set (this.picker.currentDev.timeTracked.filter(tt => tt.type !== 'Bug' && tt.parentType !== 'Bug' && tt.type !== 'Story' && tt.parentType !== 'Story').map(a => a.id))
      ].length;
    });
  }
 
  printParent(id){
    //revisar JORGE
    var a = this.picker.currentDev.timeTracked.filter(elem => elem.parent === id);
    return a;
  }

  ngAfterViewInit(): void {
    if (this.picker.currentDev) {
      this.picker.currentDev.timeTrackedDS = new MatTableDataSource(this.picker.currentDev.timeTracked);
      this.picker.currentDev.timeTrackedDS.sort = this.sort;
    }
  }
}
