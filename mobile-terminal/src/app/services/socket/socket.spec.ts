/// <reference types="jest" />
import { TestBed } from '@angular/core/testing';
// Using test globals provided by the test runner (Jest) — no explicit import needed

import { Socket } from './socket';

describe('Socket', () => {
  let service: Socket;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Socket);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
