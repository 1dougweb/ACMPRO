/**
 * Utilitário para detecção e normalização de players de vídeo
 * Suporta YouTube, Vimeo, Loom, Google Drive e MP4 direto.
 */

export type VideoType = 'youtube' | 'vimeo' | 'mp4' | 'embed' | 'none'

export interface ParsedVideo {
  type: VideoType
  src: string
}

export function parseVideoUrl(rawUrl?: string | null): ParsedVideo {
  if (!rawUrl || !rawUrl.trim()) {
    return { type: 'none', src: '' }
  }

  const url = rawUrl.trim()

  // YouTube
  // Matches: youtube.com/watch?v=XYZ, youtu.be/XYZ, youtube.com/embed/XYZ, youtube.com/shorts/XYZ
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`,
    }
  }

  // Vimeo
  // Matches: vimeo.com/123456789
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i)
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoMatch[3]}?title=0&byline=0&portrait=0`,
    }
  }

  // Loom
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/i)
  if (loomMatch && loomMatch[1]) {
    return {
      type: 'embed',
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
    }
  }

  // Google Drive
  const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i)
  if (gdriveMatch && gdriveMatch[1]) {
    return {
      type: 'embed',
      src: `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`,
    }
  }

  // Arquivo de vídeo direto (.mp4, .webm, .ogg, .mov)
  if (url.match(/\.(mp4|webm|ogg|mov)($|\?)/i)) {
    return {
      type: 'mp4',
      src: url,
    }
  }

  // Se já for uma URL de embed ou iframe genérico
  return {
    type: 'embed',
    src: url,
  }
}
