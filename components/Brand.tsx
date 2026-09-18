export function Brand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`brand ${
        compact ? "brand-compact" : ""
      }`}
    >
      <img
        src="/logo.png"
        alt="Mogified Moments"
        width={compact ? 88 : 190}
        height={compact ? 88 : 190}
      />

      {!compact && (
        <div className="brand-copy">
          <strong>Mogified Moments</strong>
          <span>Turn moments into magnets.</span>
        </div>
      )}
    </div>
  );
}