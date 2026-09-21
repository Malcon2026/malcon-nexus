import { useEffect, useState } from 'react';

/** True on typical phones (below Tailwind `md`, 768px). Tablets / desktop use the full case form. */
export function usePhoneViewport(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return phone;
}
