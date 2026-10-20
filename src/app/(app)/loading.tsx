export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-4 py-12 sm:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-1/2 animate-pulse rounded-lg bg-black/5" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-black/5" />
      <div className="h-32 animate-pulse rounded-xl bg-black/5" />
    </div>
  );
}
