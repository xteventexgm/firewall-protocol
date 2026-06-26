import { ObjectId } from 'mongodb';
import { Team } from '../types/team';
import { getDb } from './mongoConnection';

export type ParticipationDocument = {
  _id?: ObjectId;
  userId: ObjectId | null;
  guestPlayerId: string;
  roomId: string;
  playerName: string;
  role?: string;
  team?: string;
  won: boolean;
  isMvp: boolean;
  eliminatedOnDay?: number;
  finishedAt: Date;
};

function participations() {
  return getDb().collection<ParticipationDocument>('game_participations');
}

function playerWon(
  player: { id: string; team?: string; role?: string; isAlive?: boolean },
  winner: string | null | undefined,
  soloWinner: { playerId?: string } | null | undefined,
): boolean {
  if (soloWinner?.playerId) return soloWinner.playerId === player.id;
  if (!winner) return false;
  if (winner === Team.SYSTEM) return player.team === 'system' && player.isAlive !== false;
  if (winner === Team.BLACK_HAT) return player.team === 'black_hat' && player.isAlive !== false;
  return false;
}

export async function recordGameParticipations(
  roomId: string,
  state: Record<string, unknown>,
): Promise<number> {
  const players = (state.players ?? []) as Array<{
    id: string;
    name: string;
    role?: string;
    team?: string;
    isAlive?: boolean;
    userId?: string;
    isBot?: boolean;
  }>;
  const winner = state.winner as string | null | undefined;
  const soloWinner = state.soloWinner as { playerId?: string } | null | undefined;
  const mvpPlayerId = (state.gameStats as { mvpPlayerId?: string } | undefined)?.mvpPlayerId;
  const dayNumber = Number(state.dayNumber ?? 0);
  const finishedAt = new Date();

  const docs: ParticipationDocument[] = players
    .filter((p) => !p.isBot)
    .map((p) => ({
      userId: p.userId && ObjectId.isValid(p.userId) ? new ObjectId(p.userId) : null,
      guestPlayerId: p.id,
      roomId: roomId.toUpperCase(),
      playerName: p.name,
      role: p.role,
      team: p.team,
      won: playerWon(p, winner, soloWinner),
      isMvp: mvpPlayerId === p.id,
      eliminatedOnDay: p.isAlive === false ? dayNumber : undefined,
      finishedAt,
    }));

  if (!docs.length) return 0;
  await participations().insertMany(docs);
  return docs.length;
}

export async function listParticipationsByUser(
  userId: string,
  limit = 10,
): Promise<ParticipationDocument[]> {
  if (!ObjectId.isValid(userId)) return [];
  return participations()
    .find({ userId: new ObjectId(userId) })
    .sort({ finishedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function incrementUserStatsAfterGame(
  userId: string,
  participation: { won: boolean; isMvp: boolean; role?: string; team?: string },
): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  const users = getDb().collection('users');
  const inc: Record<string, number> = { 'stats.gamesPlayed': 1 };
  if (participation.isMvp) inc['stats.mvpCount'] = 1;
  if (participation.won && participation.team) {
    inc[`stats.winsByTeam.${participation.team}`] = 1;
  }
  const update: Record<string, unknown> = { $inc: inc };
  if (participation.role) {
    update.$addToSet = { 'stats.favoriteRoles': participation.role };
  }
  await users.updateOne({ _id: new ObjectId(userId) }, update);
}
