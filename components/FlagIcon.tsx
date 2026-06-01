export function FlagIcon({
  cc,
  name,
  className = "w-7 h-5",
}: {
  cc: string;
  name: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt={`${name} flag`}
      className={`inline-block flex-shrink-0 rounded-sm object-cover ${className}`}
    />
  );
}
