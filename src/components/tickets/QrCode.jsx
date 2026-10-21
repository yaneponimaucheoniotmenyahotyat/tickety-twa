import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

const QUIET_ZONE = 4; // поле в модулях по стандарту — без него сканеры ошибаются

// QR одним SVG-path: чёткий при любом масштабе. Всегда чёрный на белом,
// даже в тёмной теме — иначе турникетные сканеры не читают код.
export default function QrCode({ value, className = '' }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { size: n, path: d };
  }, [value]);

  const full = size + QUIET_ZONE * 2;
  return (
    <svg
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${full} ${full}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR-код билета"
      className={className}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={full} height={full} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
