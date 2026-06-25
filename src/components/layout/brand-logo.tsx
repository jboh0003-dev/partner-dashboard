import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  className = "h-9 w-auto object-contain",
  priority = false
}: BrandLogoProps) {
  return (
    <Image
      src="/images/okestro-logo.png"
      alt="OKESTRO"
      width={180}
      height={48}
      priority={priority}
      className={className}
    />
  );
}
