import { useAmbientState } from '@/lib/ambient';

/**
 * The room's only light: a soft wash of the current title's colour from the
 * top of the viewport. `--ambient` is a registered <color>, so switching films
 * interpolates smoothly instead of snapping.
 */
export const AmbientGlow = () => {
  const { color, lit } = useAmbientState();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 transition-[--ambient,opacity] duration-(--dur-scene) ease-(--ease-out)"
      style={{
        ...(color ? { '--ambient': color } : {}),
        opacity: lit ? 1 : 0,
        background:
          'radial-gradient(130% 80% at 50% 30%, color-mix(in oklch, var(--ambient) 32%, transparent), transparent 75%), ' +
          'radial-gradient(70% 50% at 100% 75%, color-mix(in oklch, var(--ambient) 12%, transparent), transparent 70%)',
      } as React.CSSProperties}
    />
  );
};
