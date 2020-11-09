import { map } from 'rxjs/operators';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { DevPickerService } from '../dev-picker.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ChartDataSets, ChartOptions } from 'chart.js';
import { Color, BaseChartDirective, Label } from 'ng2-charts';

@Component({
  selector: 'app-summary-line-chart',
  templateUrl: './summary-line-chart.component.html',
  styleUrls: ['./summary-line-chart.component.scss']
})
export class SummaryLineChartComponent implements OnInit {
  public lineChartData: ChartDataSets[] = [];
  public lineChartLabels: Label[] = [];
  public lineChartOptions: (ChartOptions & { annotation: any }) = {
    responsive: true,
    scales: {
      // We use this empty structure as a placeholder for dynamic theming.
      xAxes: [{}],
      yAxes: [
        {
          id: 'y-axis-0',
          position: 'left',
        }
      ]
    },
    annotation: {
      annotations: [
        {
          type: 'line',
          mode: 'vertical',
          scaleID: 'x-axis-0',
          value: 'March',
          borderColor: 'orange',
          borderWidth: 2,
          label: {
            enabled: true,
            fontColor: 'orange',
            content: 'LineAnno'
          }
        },
      ],
    },
  };
  public lineChartColors: Color[] = [
    { 
      backgroundColor: 'rgba(63,191,63,0.2)',
      borderColor: 'rgba(63,191,63,1)',
      pointBackgroundColor: 'rgba(77,83,96,1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(77,83,96,1)'
    },
    { 
      backgroundColor: 'rgba(191,127,63,0.3)',
      borderColor: 'rgba(191,127,63,1)',
      pointBackgroundColor: 'rgba(148,159,177,1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(148,159,177,0.8)'
    },
    { 
      backgroundColor: 'rgba(191,63,63,0)',
      borderColor: 'rgba(191,63,63,1)',
      pointBackgroundColor: 'rgba(148,159,177,1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(148,159,177,0.8)'
    },
    { 
      backgroundColor: 'rgba(63,63,63,0)',
      borderColor: 'rgba(63,63,63,1)',
      pointBackgroundColor: 'rgba(148,159,177,1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(148,159,177,0.8)'
    },
  ];
  public lineChartLegend = true;
  public lineChartType = 'line';

  @ViewChild(BaseChartDirective, { static: true }) chart: BaseChartDirective;

  constructor(private breakpointObserver: BreakpointObserver, public picker: DevPickerService) {}

  ngOnInit() {
    this.picker.updateData$.subscribe(() => {
      this.lineChartLabels = Object.keys(this.picker.currentSprint.devStats).filter(x => x !== 'Sprint Summary').sort();
      this.lineChartData = [
        // Time logged:
        { data: this.lineChartLabels.map(dev => this.picker.currentSprint.devStats[`${dev}`]?
            this.picker.currentSprint.devStats[`${dev}`].summary.totalTimeTrackedH
            : 0), label: 'Time Tracked', hidden: false },
        // Time in stories:
        { data: this.lineChartLabels.map(dev => this.picker.currentSprint.devStats[`${dev}`]?
        this.picker.currentSprint.devStats[`${dev}`].timeTracked.filter(tt => tt.type === 'Story' || tt.parentType === 'Story').reduce((acc, act) => acc + act.timeH, 0)
        : 0), label: 'Time on stories', hidden: false },
        // Time in stories:
        { data: this.lineChartLabels.map(dev => this.picker.currentSprint.devStats[`${dev}`]?
         this.picker.currentSprint.devStats[`${dev}`].timeTracked.filter(tt => tt.type === 'Bug' || tt.parentType === 'Bug').reduce((acc, act) => acc + act.timeH, 0)
         : 0), label: 'Time on bugs', hidden: false },
        // Time in stories:
        { data: this.lineChartLabels.map(dev => this.picker.currentSprint.devStats[`${dev}`]?
         this.picker.currentSprint.devStats[`${dev}`].timeTracked.filter(tt => tt.type !== 'Bug' && tt.parentType !== 'Bug' && tt.type !== 'Story' && tt.parentType !== 'Story').reduce((acc, act) => acc + act.timeH, 0)
         : 0), label: 'Time on others', hidden: false }
      ];
    })
    this.picker.updateData$.next();
  }
  
}
