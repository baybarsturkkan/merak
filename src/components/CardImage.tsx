import { useRef, useState } from 'react';
import type { CardImage as CardImageInfo } from '../lib/schema';

/**
 * Kart görseli (Wikimedia Commons). Dokununca tam ekran açılır.
 * hideCredit: soru tarafında atıf gizlenir, çünkü yazar adı cevabı verebilir.
 */
export function CardImage({
  image,
  hideCredit = false,
  compact = false,
}: {
  image: CardImageInfo;
  hideCredit?: boolean;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const ratio = image.w && image.h ? `${image.w} / ${image.h}` : undefined;

  return (
    <figure className={`card-figure${compact ? ' compact' : ''}`}>
      {failed ? (
        <div className="figure-fallback" role="img" aria-label={image.alt}>
          <span>{image.alt}</span>
          <small>Görsel yüklenemedi</small>
        </div>
      ) : (
        <button
          type="button"
          className="figure-zoom"
          onClick={() => dialog.current?.showModal()}
          aria-label="Görseli büyüt"
        >
          <img
            src={image.src}
            alt={image.alt}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            decoding="async"
            width={image.w}
            height={image.h}
            style={ratio ? { aspectRatio: ratio } : undefined}
            onError={() => setFailed(true)}
          />
        </button>
      )}
      {!hideCredit && (
        <figcaption className="figure-credit">
          <a href={image.page} target="_blank" rel="noreferrer noopener">
            {image.credit}
          </a>{' '}
          · Wikimedia Commons
        </figcaption>
      )}
      {!failed && (
        <dialog ref={dialog} className="figure-dialog" onClick={() => dialog.current?.close()}>
          <img src={image.src} alt={image.alt} crossOrigin="anonymous" referrerPolicy="no-referrer" />
          <button type="button" className="btn btn-sm">
            Kapat
          </button>
        </dialog>
      )}
    </figure>
  );
}

/** Oturumdaki kartların görsellerini önceden indirir: geçişte bekleme olmaz, servis işçisi önbelleğe alır. */
const preloaded = new Set<string>();
export function preloadImages(srcs: Iterable<string>): void {
  for (const src of srcs) {
    if (preloaded.has(src)) continue;
    preloaded.add(src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  }
}
