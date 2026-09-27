export function CourseThumbnail({
  title,
  thumbnail,
  className,
}: {
  title: string;
  thumbnail: string | null;
  className?: string;
}) {
  if (thumbnail?.startsWith("https://")) {
    return (
      // Remote course art is optional and not part of the image optimizer config.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbnail} alt="" className={className} />
    );
  }

  return (
    <div className={`flex items-end bg-muted p-4 ${className ?? ""}`}>
      <span className="font-mono text-xs tracking-wide text-primary uppercase">{title.slice(0, 18)}</span>
    </div>
  );
}
