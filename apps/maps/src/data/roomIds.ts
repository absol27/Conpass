import { locations } from './saltpalace/locations'

/** The id apps/web gives a room: its Sessionize location string, slugged the same way as apps/web/scripts/import-schedule.ts. */
export function webRoomId(location: string): string {
  return location
    .toLowerCase()
    .replace(/salt palace/g, 'sp')
    .replace(/hyatt regency/g, 'hyatt')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// apps/web's "entrance" is the main door it gives directions from.
const ENTRANCE = 'Salt Palace | 200 South Entrance (South)'
const byWebId = new Map(Object.keys(locations).map((loc) => [webRoomId(loc), loc]))

/** Location string for an apps/web room id, if this venue knows it. */
export const locationForWebRoom = (id: string): string | undefined => (id === 'entrance' ? ENTRANCE : byWebId.get(id))
