import { useEffect, useState } from 'react';

export function useObjectUrl(blob: Blob | null | undefined): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

export function ItemImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  return url ? <img className={className} src={url} alt={alt} loading="lazy" /> : <span className={className} />;
}
