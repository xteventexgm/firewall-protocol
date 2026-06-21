import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const roomGuard: CanActivateFn = () => {
  const playerId = localStorage.getItem('myPlayerId');
  const roomCode = localStorage.getItem('roomCode');
  if (playerId && roomCode) {
    return true;
  }

  inject(Router).navigate(['/login']);
  return false;
};
