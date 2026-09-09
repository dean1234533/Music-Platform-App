# Music access model migration

New uploads store `durationSeconds`, `durationFormatted`, `previewEnabled`, and `status: "published"` alongside the existing `visibility`, preview, streaming, and original paths.

Existing tracks remain compatible without a destructive data migration:

- a missing `status` is treated as `published`, because older uploads created their Firestore document only after all files uploaded;
- a missing `previewEnabled` is treated as `true`;
- existing `visibility` values map directly to the current access modes;
- missing duration metadata is shown as unavailable rather than guessed;
- existing preview, streaming, and original paths keep their current meaning and Storage protection.

Do not invent a duration for an older track. Re-upload or run a trusted backend metadata extraction before populating `durationSeconds` and `durationFormatted`.

New default uploads use `followers` access with a 45-second preview. Changing the platform default never rewrites an existing track.

Security decisions remain server-side in `getTrackPlaybackUrl`; UI relationship state is descriptive only. Original masters remain owner-only in Storage and are delivered to DJs solely through `downloadLicensedTrack` after an active agreement.
