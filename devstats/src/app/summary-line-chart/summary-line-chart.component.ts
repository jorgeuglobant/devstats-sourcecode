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

  ngOnInit(): void {
    this.picker.updateData$.subscribe(() => {
      this.lineChartLabels = [...new Set(this.picker.currentSprint.timeTracks.map(it => it.dev))] as any;
      this.lineChartData = [
        // Time logged:
        { data: this.lineChartLabels
                  .map(dev => this.picker.currentSprint.timeTracks.filter(track => track.dev === dev)
                  .reduce((time, track) => time + track.timeH,0)),
          label: 'Time Tracked',
          hidden: false },
        // Time in stories:
        { data: this.lineChartLabels
                .map(dev => this.picker.currentSprint.timeTracks.filter(track => track.dev === dev && track.type === 'Story')
                .reduce((time, track) => time + track.timeH,0)),
          label: 'Time on Stories',
          hidden: false },
        // Time in stories:
        { data: this.lineChartLabels
                .map(dev => this.picker.currentSprint.timeTracks.filter(track => track.dev === dev && track.type === 'Bug')
                .reduce((time, track) => time + track.timeH,0)),
          label: 'Time on Bugs',
          hidden: false },
        // Time in stories:
        { data: this.lineChartLabels
                .map(dev => this.picker.currentSprint.timeTracks.filter(track => track.dev === dev && track.type !== 'Story' && track.type !== 'Bug')
                .reduce((time, track) => time + track.timeH,0)),
          label: 'Time on others',
          hidden: false }
      ];
    });
    this.picker.updateData$.next();
  }
  
}
