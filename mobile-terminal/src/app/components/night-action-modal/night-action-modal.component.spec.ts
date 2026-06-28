import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NightActionModalComponent } from './night-action-modal.component';

describe('NightActionModalComponent', () => {
  let component: NightActionModalComponent;
  let fixture: ComponentFixture<NightActionModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [NightActionModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NightActionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
