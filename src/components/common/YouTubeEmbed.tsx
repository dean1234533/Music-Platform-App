import { getYouTubeEmbedUrl, getYouTubeVideoId } from '@/utils/youtube'

/** Responsive 16:9 embed. Renders nothing if the URL isn't recognisably YouTube — callers show a plain link instead. */
export function YouTubeEmbed({ url, title }: { url: string; title: string }) {
  const videoId = getYouTubeVideoId(url)
  if (!videoId) return null

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        src={getYouTubeEmbedUrl(videoId)}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
