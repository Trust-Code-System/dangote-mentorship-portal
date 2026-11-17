/** A small startup indicator; route skeletons take over inside the workspace. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="bg-bg grid min-h-screen place-items-center"
    >
      <div aria-hidden="true" className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="startup-dot bg-ink-2 size-1.5 rounded-full" />
        ))}
      </div>
    </div>
  );
}
