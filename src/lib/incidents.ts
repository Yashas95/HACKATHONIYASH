import { useSyncExternalStore } from 'react'
import type { Incident } from '../types'

const KEY = 'edgeguard.incidents.v1'
let incidents: Incident[] = load()
const listeners = new Set<() => void>()

function load(): Incident[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function commit(next: Incident[]) {
  incidents = next.slice(0, 200)
  try { localStorage.setItem(KEY, JSON.stringify(incidents)) } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l())
}

export const incidentStore = {
  get: () => incidents,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  create(i: Incident) { commit([i, ...incidents]) },
  update(id: string, patch: Partial<Incident>, note?: string) {
    commit(incidents.map((i) => i.id === id
      ? { ...i, ...patch, timeline: note ? [...i.timeline, { t: Date.now(), text: note }] : i.timeline }
      : i))
  },
  clear() { commit([]) },
}

export const useIncidents = () => useSyncExternalStore(incidentStore.subscribe, incidentStore.get)
