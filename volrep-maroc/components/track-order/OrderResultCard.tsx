import { ButtonLink } from "@/components/ui/Button";
import type { OrderTrackingInfo } from "@/lib/backend/orders";
import { orderStatusLabel, t } from "@/lib/i18n";

const TRACKING_UNAVAILABLE_MESSAGE = t.trackOrder.result.unavailable;

export function OrderResultCard({ order }: { order: OrderTrackingInfo }) {
  return (
    <div
      role="status"
      className="rounded-[18px] border border-black/[0.06] bg-white px-6 py-8 shadow-[0_1px_2px_rgba(11,11,11,0.04)] sm:px-8 sm:py-10"
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {t.trackOrder.result.orderLabel(order.name)}
      </p>

      <div className="mt-3 flex items-center gap-2.5">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-volt" />
        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{orderStatusLabel(order.status)}</p>
      </div>

      {order.lineItems.length > 0 && (
        <div className="mt-8 border-t border-black/[0.06] pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t.trackOrder.result.items}</p>
          <ul className="mt-4 flex flex-col gap-3">
            {order.lineItems.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex items-center justify-between gap-4">
                <span className="text-[15px] font-medium text-foreground">{item.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{t.trackOrder.result.quantity(item.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 border-t border-black/[0.06] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t.trackOrder.result.shipping}</p>

        {order.fulfillment ? (
          <div className="mt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {order.fulfillment.carrier && (
                <div>
                  <p className="text-xs text-muted-foreground">{t.trackOrder.result.carrier}</p>
                  <p className="mt-1 text-[15px] font-medium text-foreground">{order.fulfillment.carrier}</p>
                </div>
              )}
              {order.fulfillment.trackingNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">{t.trackOrder.result.trackingNumber}</p>
                  <p className="mt-1 text-[15px] font-medium text-foreground">{order.fulfillment.trackingNumber}</p>
                </div>
              )}
            </div>

            {order.fulfillment.trackingUrl && (
              <ButtonLink
                href={order.fulfillment.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="lg"
                className="mt-6 w-full"
              >
                {t.trackOrder.result.trackShipment}
              </ButtonLink>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{TRACKING_UNAVAILABLE_MESSAGE}</p>
        )}
      </div>
    </div>
  );
}
