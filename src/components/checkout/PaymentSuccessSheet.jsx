import Icon from '@/components/icons/Icon';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/lib/format';

export default function PaymentSuccessSheet({ open, onClose, onTickets, total, eventTitle }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Button size="lg" block onClick={onTickets}>
          Перейти в «Мои билеты»
        </Button>
      }
    >
      <div className="flex flex-col items-center pb-2 pt-4 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-success-soft text-success">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-success text-white">
            <Icon name="check" className="h-12 w-12" />
          </span>
        </span>
        <h2 className="mt-4 text-title2">Оплата прошла</h2>
        <p className="mt-1 text-subhead text-label-secondary">
          {formatPrice(total)} заморожены на эскроу-счёте до вашего прохода на «{eventTitle}».
        </p>
        <div className="card mt-5 flex w-full items-start gap-3 p-4 text-left">
          <Icon name="qr" className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
          <p className="text-footnote text-label-secondary">
            Билет появится в «Мои билеты» после переоформления продавцом. Обычно это занимает до 15 минут — мы
            пришлём уведомление в Telegram.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
