import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { App } from './app';
import { GameSocketService } from './core/services/game-socket.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: GameSocketService,
          useValue: {
            connect: () => undefined,
            createLobby: () => 'FIRE-TEST',
            joinRoom: () => undefined,
            softLeave: () => undefined,
            leaveLobby: () => undefined,
            startGame: () => undefined,
            advancePhase: () => undefined,
            isGameEnded: false,
            connected$: new BehaviorSubject(false),
            roomState$: new BehaviorSubject(null),
            incidents$: new Subject(),
            phaseTransition$: new Subject(),
            gameOver$: new Subject(),
            voteTied$: new Subject(),
            voteTrace$: new Subject(),
            error$: new Subject(),
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
