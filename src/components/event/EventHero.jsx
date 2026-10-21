import Badge from '@/components/ui/Badge';
import EventCover from './EventCover';

export default function EventHero({ event }) {
  return (
    <EventCover event={event} className="h-64 rounded-3xl">
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      {event.authenticity && (
        <div className="absolute left-4 top-4">
          <Badge tone="glassSuccess" icon="shield-check">Гарантия подлинности</Badge>
        </div>
      )}
      <div className="absolute inset-x-4 bottom-4 text-white">
        <p className="text-caption1 font-semibold uppercase tracking-wider text-white/75">
          {event.tags.join(' • ')}
        </p>
        <h2 className="mt-1 text-title1 [text-wrap:balance]">{event.title}</h2>
      </div>
    </EventCover>
  );
}
