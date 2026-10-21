// Обложка события: фото, если есть event.image, иначе «сценический» градиент
// из трёх цветов event.cover (лучи прожекторов + засветка + тёмный зал).
export default function EventCover({ event, className = '', children }) {
  const [base, light1, light2] = event.cover;
  const style = event.image
    ? { backgroundImage: `url(${event.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {
        background: [
          `conic-gradient(from 160deg at 50% -15%, transparent 0deg, ${light1}40 8deg, transparent 18deg, ${light2}40 30deg, transparent 42deg, ${light1}33 52deg, transparent 64deg)`,
          `radial-gradient(90% 70% at 22% 8%, ${light1}d9 0%, transparent 58%)`,
          `radial-gradient(80% 70% at 88% 22%, ${light2}b3 0%, transparent 55%)`,
          `radial-gradient(130% 55% at 50% 115%, #000000cc 0%, transparent 65%)`,
          `linear-gradient(165deg, ${base} 0%, #07070C 100%)`,
        ].join(','),
      };

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}
