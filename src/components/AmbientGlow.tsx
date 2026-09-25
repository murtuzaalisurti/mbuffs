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
          'radial-gradient(120% 65% at 50% -5%, color-mix(in oklch, var(--ambient) 40%, transparent), transparent 72%), ' +
          'radial-gradient(60% 45% at 100% 30%, color-mix(in oklch, var(--ambient) 14%, transparent), transparent 70%)',
      } as React.CSSProperties}
    />
  );
};
