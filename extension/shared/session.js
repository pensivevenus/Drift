import { saveSession, getSession, addEventToSession } from './db.js';

export function generateId() {
  return crypto.randomUUID();
}

export async function createSession(intention) {
  const session = {
    id: generateId(),
    intention,
    startTime: Date.now(),
    endTime: null,
    events: [],
    interrupts: 0,
  };
  await saveSession(session);
  return session;
}

export async function endSession(id) {
  const session = await getSession(id);
  if (!session) return null;
  session.endTime = Date.now();
  await saveSession(session);
  return session;
}

export async function addEvent(id, event) {
  await addEventToSession(id, event);
}