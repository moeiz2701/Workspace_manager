import { seedDatabase, sql } from './fixtures';

/**
 * Rebuild the fixture once before the suite. The specs that mutate data reseed
 * themselves, so the order they run in does not matter.
 */
export default function globalSetup() {
  seedDatabase();

  const tasks = sql('select count(*) from tasks');
  if (tasks !== '3') {
    throw new Error(`e2e fixture did not seed correctly: expected 3 tasks, found ${tasks}`);
  }
}
