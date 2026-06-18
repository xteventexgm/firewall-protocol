import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { GameSocketService } from './core/services/game-socket.service';
import { BehaviorSubject } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: GameSocketService,
          useValue: {
            connect: () => undefined,
            connected$: new BehaviorSubject(false),
            roomState$: new BehaviorSubject(null),
            incidents$: new BehaviorSubject([]),
            error$: new BehaviorSubject(''),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
