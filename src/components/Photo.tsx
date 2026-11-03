import Image, { type ImageProps } from "next/image";

/** next/image для файлов из /uploads; SVG-заглушки отдаём без оптимизации. */
export function Photo({ alt, ...props }: ImageProps & { src: string }) {
  return <Image alt={alt} {...props} unoptimized={props.src.endsWith(".svg")} />;
}
