import { FC, useEffect, useState } from 'react';
import SafeImage from './safe.image';
interface ImageSrc {
  src: string;
  fallbackSrc: string;
  width: number;
  height: number;
  onFallback?: () => void;
  [key: string]: any;
}
const ImageWithFallback: FC<ImageSrc> = (props) => {
  const { src, fallbackSrc, onFallback, onError, ...rest } = props;
  const [imgSrc, setImgSrc] = useState(src);
  useEffect(() => {
    if (src !== imgSrc) {
      setImgSrc(src);
    }
  }, [src]);
  return (
    <SafeImage
      alt=""
      {...rest}
      src={imgSrc}
      onError={(event: any) => {
        setImgSrc(fallbackSrc);
        onFallback?.();
        onError?.(event);
      }}
    />
  );
};
export default ImageWithFallback;
