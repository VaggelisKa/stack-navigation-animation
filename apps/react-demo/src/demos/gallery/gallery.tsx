import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { api, type Photo } from '../fake-api';
import { BackButton, Deferred, ErrorBox, PushLink, Skeleton, Spinner, useResource } from '../shared';

const paint = (p: Photo) => `linear-gradient(${p.angle}deg, hsl(${p.hues[0]} 70% 55%), hsl(${p.hues[1]} 65% 35%))`;

/** A dense three-column grid of tiles on a light page. */
export function GalleryGrid() {
  const photos = useResource(() => api.photos(), []);
  const [columns, setColumns] = useState(3);
  return (
    <div className="page gal" data-page="gallery">
      <header className="hdr gal-hdr">
        <BackButton to="/">‹ Demos</BackButton>
        <h1>Gallery</h1>
        <button type="button" className="gal-toggle" onClick={() => setColumns(columns === 3 ? 2 : 3)} aria-label={`Show ${columns === 3 ? 2 : 3} columns`}>
          {columns === 3 ? '▦' : '▤'}
        </button>
      </header>
      {photos.error != null ? (
        <ErrorBox error={photos.error} onRetry={photos.reload} />
      ) : photos.loading ? (
        <div className="gal-grid" style={{ '--cols': columns } as CSSProperties}>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="gal-tile skel-tile" />
          ))}
        </div>
      ) : (
        <div className="gal-grid" style={{ '--cols': columns } as CSSProperties}>
          {photos.value?.map((p) => (
            <Link key={p.id} className="gal-tile" to={`/gallery/${p.id}`} style={{ background: paint(p) }} aria-label={p.title} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A dark viewer. The filmstrip's links are siblings in the route tree, so they
 * replace this page in place. "Next" is an explicit push, so the stack grows
 * and swiping back retraces the photos you opened. A deferred block loads the
 * details shortly after the page lands.
 */
export function GalleryPhoto() {
  const { id: idParam = '' } = useParams();
  const id = Number(idParam);
  const count = api.photoCount();
  const photo = useResource(() => api.photo(id), [id]);
  const [liked, setLiked] = useState(false);
  const lo = Math.max(1, Math.min(id - 3, count - 6));
  const strip = Array.from({ length: 7 }, (_, i) => lo + i);
  const p = photo.value;

  return (
    <div className="page gal gal-dark" data-page="gallery-photo">
      <header className="hdr gal-hdr-dark">
        <BackButton to="/gallery">‹ Gallery</BackButton>
        <h1>{p?.title ?? 'Photo'}</h1>
        <button type="button" className={liked ? 'gal-like on' : 'gal-like'} onClick={() => setLiked((v) => !v)} aria-label="Like">
          {liked ? '♥' : '♡'}
        </button>
      </header>
      {photo.error != null ? (
        <ErrorBox error={photo.error} onRetry={photo.reload} />
      ) : p ? (
        <>
          <div className="gal-stage">
            <div className="gal-photo" style={{ background: paint(p), aspectRatio: p.ratio }} />
          </div>
          <div className="gal-caption">
            <b>{p.title}</b>
            <span>{p.place}</span>
          </div>
          <Deferred ms={400} placeholder={<Skeleton lines={2} />}>
            <dl className="gal-exif">
              <div>
                <dt>Camera</dt>
                <dd>Fable X100</dd>
              </div>
              <div>
                <dt>Lens</dt>
                <dd>23 mm ƒ/2</dd>
              </div>
              <div>
                <dt>Exposure</dt>
                <dd>1/{60 + p.id * 20} s</dd>
              </div>
              <div>
                <dt>ISO</dt>
                <dd>{100 * (1 + (p.id % 5))}</dd>
              </div>
            </dl>
          </Deferred>
          <div className="gal-strip">
            {strip.map((n) => (
              <Link key={n} to={`/gallery/${n}`} className={n === id ? 'on' : undefined} style={{ background: `hsl(${(n * 47) % 360} 60% 45%)` }} aria-label={`Photo ${n}`} />
            ))}
          </div>
          <div className="gal-nav">
            <span>
              {id} / {count}
            </span>
            {id < count && <PushLink to={`/gallery/${id + 1}`}>Next ›</PushLink>}
          </div>
        </>
      ) : (
        <Spinner />
      )}
    </div>
  );
}
