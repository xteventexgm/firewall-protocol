import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RoomLobbyComponent } from './room-lobby.component';

describe('RoomLobbyComponent', () => {
  let component: RoomLobbyComponent;
  let fixture: ComponentFixture<RoomLobbyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [RoomLobbyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomLobbyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
