import 'dotenv/config';
import { Db, MongoClient } from 'mongodb';
import { MONGO_DB_NAME, MONGO_URI } from '../src/config/env';
import { buildRoleAssignedPayload } from '../src/game/roleInfo';
import { ROLE_NIGHT_ACTIONS } from '../src/types/player-metadata.types';
import { ROLE_CATALOG, RoleName } from '../src/types/roles.types';

type SeededRole = { _id: string; [key: string]: unknown };

const SECONDARY_TARGET_ROLES = new Set<RoleName>([
  RoleName.BGP_ROUTER,
  RoleName.PHISHER,
  RoleName.MITM_PROXY,
  RoleName.CHAOS_ROUTER,
]);

export async function seedRoles(db: Db): Promise<number> {
  const roles = db.collection<SeededRole>('roles');
  const operations = Object.values(RoleName).map((role) => {
    const catalog = ROLE_CATALOG[role];
    const info = buildRoleAssignedPayload(role, catalog.team);
    return {
      updateOne: {
        filter: { _id: role },
        update: { $set: {
          team: catalog.team,
          displayName: catalog.displayName,
          description: catalog.description,
          playerGuide: catalog.playerGuide,
          priority: catalog.priority,
          nightActions: ROLE_NIGHT_ACTIONS[role] ?? [],
          nightActionHint: info.nightActionHint,
          victoryHint: info.victoryHint,
          teamLabel: info.teamLabel,
          needsSecondaryTarget: SECONDARY_TARGET_ROLES.has(role),
          isPassiveNight: !(ROLE_NIGHT_ACTIONS[role]?.length),
          locale: 'es',
          version: 1,
        } },
        upsert: true,
      },
    };
  });
  if (!operations.length) return 0;
  await roles.bulkWrite(operations);
  return operations.length;
}

async function main(): Promise<void> {
  if (!MONGO_URI) throw new Error('MONGO_URI is required');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const roleCount = await seedRoles(client.db(MONGO_DB_NAME));
    console.log(`Seeded ${roleCount} roles in ${MONGO_DB_NAME}`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
}
