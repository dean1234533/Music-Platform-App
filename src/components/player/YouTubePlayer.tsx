import { useState } from 'react'
import { Play } from 'lucide-react'
import { youtubeEmbedUrl, youtubeThumbnailUrl } from '@/utils/youtube'

/**
 * Reusable, privacy-respecting official YouTube embed. Nothing is requested
 * from YouTube/Google until the viewer deliberately clicks play — before
 * that we only show a static thumbnail image, so simply viewing a track
 * page never fires a third-party request to YouTube. Playback always goes
 * through the official youtube-nocookie.com embed; there is no other audio
 * path for tracks anywhere in the app.
 */
export function YouTubePlayer({
  videoId,
  title,
  className = '',
}: {
  videoId: string
  title: string
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      {loaded ? (
        <iframe
          className="h-full w-full"
          src={youtubeEmbedUrl(videoId)}
          title={title}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="group relative h-full w-full"
          aria-label={`Play ${title} on YouTube`}
        >
          <img src={youtubeThumbnailUrl(videoId)} alt="" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/40">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105">
              <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
            </span>
          </span>
        </button>
      )}
      <p className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">
        Played via YouTube
      </p>
    </div>
  )
}
