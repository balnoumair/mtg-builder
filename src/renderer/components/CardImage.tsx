import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
}

/** Card image with a shimmer placeholder and fade-in on load. */
export default function CardImage({ src, alt }: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={loaded ? undefined : 'card-skeleton'} style={{ width: '100%', height: '100%' }}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        ref={(el) => {
          // Cache hits can complete before onLoad is attached.
          if (el?.complete && el.naturalWidth > 0) setLoaded(true);
        }}
        className={loaded ? 'card-img loaded' : 'card-img'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
