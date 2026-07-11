import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TutorialSliderComponent } from './tutorial-slider.component';

describe('TutorialSliderComponent', () => {
  let component: TutorialSliderComponent;
  let fixture: ComponentFixture<TutorialSliderComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [TutorialSliderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorialSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
