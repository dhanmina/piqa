import { useEffect, useState } from 'react';

import { Mono } from '@/components/atoms/Mono';
import { colors, typeScale } from '@/components/tokens';

type CountdownProps = {
  until: Date | string;
  size?: number;
  color?: string;
  onDone?: () => void;
};

function format(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Ticking numbers ARE the motion — no other animation here. */
export function Countdown({ until, size = typeScale.title, color = colors.paper, onDone }: CountdownProps) {
  const target = typeof until === 'string' ? new Date(until).getTime() : until.getTime();
  const [msLeft, setMsLeft] = useState(() => target - Date.now());

  useEffect(() => {
    setMsLeft(target - Date.now());
    const id = setInterval(() => {
      const left = target - Date.now();
      setMsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        onDone?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onDone]);

  return (
    <Mono weight="medium" size={size} color={color}>
      {format(msLeft)}
    </Mono>
  );
}
