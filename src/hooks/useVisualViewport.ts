import { useEffect, useState } from 'react';

export function useVisualViewport(active = true) {
  const [viewport, setViewport] = useState(() => ({
    height: window.innerHeight,
    offsetTop: 0,
  }));

  useEffect(() => {
    if (!active) return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const update = () => {
      setViewport({
        height: visualViewport.height,
        offsetTop: visualViewport.offsetTop,
      });
    };

    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);

    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
    };
  }, [active]);

  return viewport;
}
