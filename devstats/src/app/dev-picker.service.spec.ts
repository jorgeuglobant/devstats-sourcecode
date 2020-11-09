import { TestBed } from '@angular/core/testing';

import { DevPickerService } from './dev-picker.service';

describe('DevPickerService', () => {
  let service: DevPickerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DevPickerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
