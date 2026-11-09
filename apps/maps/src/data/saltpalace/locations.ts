// Sessionize location strings (exactly as the KubeCon NA 2026 feed spells them) -> door nodes.
// When a location lists several doors the router starts/ends at whichever is nearest.
import type { LocationIndex } from '../../venue/types'

const SP = 'Salt Palace | '
const HY = 'Hyatt Regency | '

export const locations: LocationIndex = {
  [`${SP}Level 1 | 151`]: { nodes: ['d_151'], label: 'Room 151' },
  [`${SP}Level 1 | Grand Ballroom ACE`]: { nodes: ['d_gbACE'], label: 'Grand Ballroom ACE' },
  [`${SP}Level 1 | Grand Ballroom BDF`]: { nodes: ['d_gbBDF'], label: 'Grand Ballroom BDF' },
  [`${SP}Level 1 | Grand Ballroom GI`]: { nodes: ['d_gbGI'], label: 'Grand Ballroom GI' },
  [`${SP}Level 1 | Grand Ballroom H`]: { nodes: ['d_gbH'], label: 'Grand Ballroom H' },
  [`${SP}Level 1 | Grand Ballroom J`]: { nodes: ['d_gbJ'], label: 'Grand Ballroom J' },
  [`${SP}Level 1 | North Grand Ballroom Foyer`]: { nodes: ['nf'], label: 'North Grand Ballroom Foyer' },
  [`${SP}Level 1 | Hall DE`]: { nodes: ['d_hDE'], label: 'Hall DE (keynotes)' },
  [`${SP}Level 1 | Halls A-C, Halls 1-5`]: { nodes: ['d_hA', 'd_hB', 'd_hC', 'd_h1', 'd_h2', 'd_h3', 'd_h4', 'd_h5'], label: 'Solutions Showcase (Halls A–C, 1–5)' },
  [`${SP}Level 1 | Solutions Showcase | Hall 1 | Alpine Overlook Zone | Demo Theater`]: { nodes: ['x_demo'], label: 'Demo Theater · Hall 1' },
  [`${SP}Level 1 | Solutions Showcase | Hall 1 | Alpine Overlook Zone | Network Nook`]: { nodes: ['x_nook'], label: 'Network Nook · Hall 1' },
  [`${SP}Level 1 | Solutions Showcase | Halls 5 | Cosmic Canyon Zone`]: { nodes: ['x_cosmic'], label: 'Cosmic Canyon Zone · Hall 5' },
  [`${SP}Level 1 | Solutions Showcase | Hall 5 | Cosmic Canyon Zone | Project Pavilion`]: { nodes: ['x_pavilion'], label: 'Project Pavilion · Hall 5' },
  [`${SP}Level 1 | Solutions Showcase | Hall B | Starlight Summit Zone`]: { nodes: ['x_starlight'], label: 'Starlight Summit Zone · Hall B' },
  [`${SP}200 South Entrance (South)`]: { nodes: ['ent_200s'], label: '200 South Entrance' },
  [`${SP}Level 2 | 250 A-C`]: { nodes: ['d_250ac'], label: 'Room 250 A-C' },
  [`${SP}Level 2 | 250 D-F`]: { nodes: ['d_250df'], label: 'Room 250 D-F' },
  [`${SP}Level 2 | 251 A-C`]: { nodes: ['d_251ac'], label: 'Room 251 A-C' },
  [`${SP}Level 2 | 251 D-F`]: { nodes: ['d_251df'], label: 'Room 251 D-F' },
  [`${SP}Level 2 | 254`]: { nodes: ['d_254'], label: 'Room 254' },
  [`${SP}Level 2 | 255 A`]: { nodes: ['d_255a'], label: 'Room 255 A' },
  [`${SP}Level 2 | 255 BC`]: { nodes: ['d_255bc'], label: 'Room 255 BC' },
  [`${SP}Level 2 | 255 D`]: { nodes: ['d_255d'], label: 'Room 255 D' },
  [`${SP}Level 2 | 255 EF`]: { nodes: ['d_255ef'], label: 'Room 255 EF' },
  [`${SP}Level 2 | East Registration`]: { nodes: ['d_ereg'], label: 'East Registration' },
  [`${SP}Level 2 | Upper Mezzanine`]: { nodes: ['um_mid'], label: 'Upper Mezzanine' },
  [`${HY}Level 2 | Salt Lake Ballroom C`]: { nodes: ['d_slbC'], label: 'Salt Lake Ballroom C · Hyatt' },
  [`${HY}Level 2 | Salt Lake Ballroom DE`]: { nodes: ['d_slbDE'], label: 'Salt Lake Ballroom DE · Hyatt' },
  [`${HY}Level 3 | Park City`]: { nodes: ['d_park'], label: 'Park City · Hyatt' },
  [`${HY}Level 4 | Regency Ballroom A`]: { nodes: ['d_regA'], label: 'Regency Ballroom A · Hyatt' },
  [`${HY}Level 4 | Regency Ballroom B`]: { nodes: ['d_regB'], label: 'Regency Ballroom B · Hyatt' },
  [`${HY}Level 4 | Regency Ballroom B-D`]: { nodes: ['d_regB', 'd_regCD'], label: 'Regency Ballroom B-D · Hyatt' },
  [`${HY}Level 4 | Regency Ballroom CD`]: { nodes: ['d_regCD'], label: 'Regency Ballroom CD · Hyatt' },
  [`${HY}Level 5 | Capitol Reef`]: { nodes: ['d_capreef'], label: 'Capitol Reef · Hyatt' },
  'Hyatt Regency Lobby': { nodes: ['hy1'], label: 'Hyatt Regency Lobby' },
  'Off-Site Location': { offsite: true, label: 'Off-site' },
}
