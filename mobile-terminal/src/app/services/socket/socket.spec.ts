/// <reference types="jest" />
import { TestBed } from '@angular/core/testing';

// 1. IMPORTACIÓN CORREGIDA: Apuntamos a socket.service.ts y traemos SocketService
import { SocketService } from './socket.service';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    // 2. INYECCIÓN CORREGIDA
    service = TestBed.inject(SocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});