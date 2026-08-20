import Image from "next/image";

type ProductImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  eager?: boolean;
};

export default function ProductImage({ src, alt, sizes, className, eager = false }: ProductImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={640}
      height={640}
      sizes={sizes}
      quality={72}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
    />
  );
}
