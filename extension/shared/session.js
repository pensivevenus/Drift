import { saveSession, getSession, addEventToSession } from './db.js';
import { KEYS } from './constants.js';

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

  // write localStorage bridge keys for extension + web app to share
  localStorage.setItem(KEYS.ACTIVE_SESSION, session.id);
  localStorage.setItem(KEYS.INTENTION, intention);
  localStorage.setItem(KEYS.START_TIME, session.startTime);

  // update recent intentions list
  const raw = localStorage.getItem(KEYS.RECENT);
  const recent = raw ? JSON.parse(raw) : [];
  const updated = [intention, ...recent.filter(r => r !== intention)].slice(0, 5);
  localStorage.setItem(KEYS.RECENT, JSON.stringify(updated));

  return session;
}

export async function endSession(id) {
  const session = await getSession(id);
  if (!session) return;
  session.endTime = Date.now();
  await saveSession(session);

  // write session end timestamp for web app to read
  localStorage.setItem(KEYS.SESSION_END, session.endTime);

  // clear active session keys
  localStorage.removeItem(KEYS.ACTIVE_SESSION);

  return session;
}

export async function addEvent(id, event) {
  await addEventToSession(id, event);
}