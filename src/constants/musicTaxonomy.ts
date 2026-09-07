/**
 * Controlled vocabulary for track genre/mood/key. Upload and onboarding forms
 * use these as dropdowns (rather than free text) so DJ discovery filtering
 * can rely on exact matches.
 */
export const GENRES = [
  'House',
  'Deep House',
  'Tech House',
  'Techno',
  'Trance',
  'Drum & Bass',
  'Dubstep',
  'Garage',
  'UK Garage',
  'Grime',
  'Hip Hop',
  'R&B',
  'Afrobeats',
  'Amapiano',
  'Reggaeton',
  'Pop',
  'Indie',
  'Rock',
  'Alternative',
  'Electronic',
  'Ambient',
  'Disco',
  'Funk',
  'Soul',
  'Jazz',
  'Latin',
  'Reggae',
  'Folk',
  'Classical',
  'Other',
] as const

export type Genre = (typeof GENRES)[number]

export const MOODS = [
  'Uplifting',
  'Energetic',
  'Chill',
  'Dark',
  'Melancholic',
  'Romantic',
  'Aggressive',
  'Dreamy',
  'Groovy',
  'Euphoric',
] as const

export type Mood = (typeof MOODS)[number]

/** Camelot wheel notation, standard for DJ harmonic mixing. */
export const CAMELOT_KEYS = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B',
] as const

export type CamelotKey = (typeof CAMELOT_KEYS)[number]
