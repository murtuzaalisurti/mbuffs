import { useAmbientState } from '@/lib/ambient';

/**
 * A barely-there wash of the current title's colour behind the top of the
 * page. It is anchored to the top of the document (not the viewport), so it
 * scrolls away with the hero and never sits behind cards or reviews further
 * down. `--ambient` is a registered <color>, so switching films interpolates
 * smoothly instead of snapping.
 */
export const AmbientGlow = () => {
  const { color, lit } = useAmbientState();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[100svh] transition-[--ambient,opacity] duration-(--dur-scene) ease-(--ease-out)"
      style={{
        ...(color ? { '--ambient': color } : {}),
        opacity: lit ? 1 : 0,
        background:
          'radial-gradient(90% 70% at 50% 0%, color-mix(in oklch, var(--ambient) 9%, transparent), transparent 100%)',
      } as React.CSSProperties}
    />
  );
};
