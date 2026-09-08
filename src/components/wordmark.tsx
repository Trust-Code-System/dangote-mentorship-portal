// BLAK MOH wordmark: BLAK inherits the surrounding ink colour while MOH uses
// the brand green and a gold stop, matching the supplied identity.
export function Wordmark({
  name,
  className,
  // Darker brand green than the vivid logo green (#10b91f, only 2.5:1 on white):
  // #0C8517 is the WCAG-AA brand accent (4.79:1). See --green-light in globals.css.
  accentClassName = 'text-[#0C8517]',
}: {
  name: string;
  className?: string;
  accentClassName?: string;
}) {
  const isBrandName = /^BLAK\s+MOH\.?$/i.test(name.trim());

  if (isBrandName) {
    // role="img" so the aria-label is actually permitted here: a bare span maps
    // to role generic, which prohibits a name, and support is inconsistent.
    return (
      <span className={className} role="img" aria-label="BLAK MOH">
        <span>BLAK</span> <span className={accentClassName}>MOH</span>
        {/* Deeper gold than #d39b2b (2.4:1): #9A6A12 clears 4.5:1 on white. */}
        <span className="text-[#9A6A12]">.</span>
      </span>
    );
  }

  return <span className={className}>{name}</span>;
}
