import { Resend } from "resend";
import { logger } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export type OrderNotificationItem = {
  id: string;
  name: string;
  quantity: number;
};

export type OrderNotificationParams = {
  order_id: string;
  order_items: OrderNotificationItem[];
  order_total: number;
  delivery_address: string | null;
  delivery_recipient_name: string | null;
  delivery_recipient_phone: string | null;
  delivery_event: string | null;
  delivery_event_date: string | null;
  order_date: string;
  recipient_email: string;
  buyer_email: string | null;
  buyer_wallet: string;
  language?: "es" | "en";
};

const COPY = {
  es: {
    subject: "Nuevo pedido recibido - CofiBlocks",
    title: "Nuevo pedido recibido!",
    intro: "Has recibido un nuevo pedido que debes cumplir.",
    orderId: "ID del pedido",
    items: "Productos",
    product: "Producto",
    qty: "Cantidad",
    total: "Total del pedido",
    delivery: "Entrega",
    address: "Dirección de entrega",
    recipient: "Destinatario",
    phone: "Teléfono",
    event: "Evento",
    eventDate: "Fecha del evento",
    orderDate: "Fecha del pedido",
    buyer: "Comprador",
    email: "Email",
    wallet: "Wallet",
    noAddressOrEvent: "Sin dirección ni evento especificados",
  },
  en: {
    subject: "New order received - CofiBlocks",
    title: "New order to fulfill",
    intro: "You have received a new order to fulfill.",
    orderId: "Order ID",
    items: "Items",
    product: "Product",
    qty: "Quantity",
    total: "Order total",
    delivery: "Delivery",
    address: "Delivery address",
    recipient: "Recipient",
    phone: "Phone",
    event: "Event",
    eventDate: "Event date",
    orderDate: "Order date",
    buyer: "Buyer",
    email: "Email",
    wallet: "Wallet",
    noAddressOrEvent: "No address or event specified",
  },
};

function formatCurrency(amount: number, lang: "es" | "en"): string {
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function buildOrderNotificationHtml(params: OrderNotificationParams): string {
  const lang = params.language ?? "es";
  const t = COPY[lang];

  const hasAddress =
    params.delivery_address != null && params.delivery_address.trim() !== "";
  const hasEvent =
    params.delivery_event != null && params.delivery_event.trim() !== "";

  const deliverySection = hasAddress
    ? `
    <tr><td><strong>${t.address}</strong></td></tr>
    <tr><td>${params.delivery_address}</td></tr>
    ${params.delivery_recipient_name ? `<tr><td><strong>${t.recipient}</strong>: ${params.delivery_recipient_name}</td></tr>` : ""}
    ${params.delivery_recipient_phone ? `<tr><td><strong>${t.phone}</strong>: ${params.delivery_recipient_phone}</td></tr>` : ""}
  `
    : hasEvent
      ? `
    <tr><td><strong>${t.event}</strong>: ${params.delivery_event}</td></tr>
    ${params.delivery_event_date ? `<tr><td><strong>${t.eventDate}</strong>: ${params.delivery_event_date}</td></tr>` : ""}
  `
      : `<tr><td>${t.noAddressOrEvent}</td></tr>`;

  const itemsRows = params.order_items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td></tr>`
    )
    .join("");

  const buyerEmailRow =
    params.buyer_email != null && params.buyer_email.trim() !== ""
      ? `<tr><td><strong>${t.email}</strong>: ${escapeHtml(params.buyer_email)}</td></tr>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t.subject)}</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="margin: 0 0 20px 0;">
    <img src="https://app.cofiblocks.com/images/logo.png" alt="CofiBlocks" style="display: block; max-width: 100px; height: auto;" width="100" />
  </p>
  <h1 style="color: #2d5016;">${escapeHtml(t.title)}</h1>
  <p>${t.intro}</p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td><strong>${t.orderId}</strong></td><td>${escapeHtml(params.order_id)}</td></tr>
    <tr><td><strong>${t.orderDate}</strong></td><td>${escapeHtml(params.order_date)}</td></tr>
  </table>

  <h2 style="font-size: 1.1em; color: #2d5016;">${t.items}</h2>
  <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="text-align: left; padding: 8px;">${t.product}</th>
        <th style="text-align: right; padding: 8px;">${t.qty}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <p><strong>${t.total}</strong>: ${formatCurrency(params.order_total, lang)}</p>

  <h2 style="font-size: 1.1em; color: #2d5016;">${t.delivery}</h2>
  <table style="width: 100%; border-collapse: collapse;">
    ${deliverySection}
  </table>

  <h2 style="font-size: 1.1em; color: #2d5016;">${t.buyer}</h2>
  <table style="width: 100%; border-collapse: collapse;">
    ${buyerEmailRow}
    <tr><td><strong>${t.wallet}</strong>: <code style="background: #f0f0f0; padding: 2px 6px;">${escapeHtml(params.buyer_wallet)}</code></td></tr>
  </table>

  <p style="margin-top: 24px; color: #666; font-size: 0.9em;">— CofiBlocks</p>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export async function sendOrderNotificationEmail(
  params: OrderNotificationParams
): Promise<{ id: string } | { error: unknown }> {
  const from =
    process.env.RESEND_FROM_EMAIL ?? "CofiBlocks <onboarding@resend.dev>";
  const lang = params.language ?? "es";
  const subject = COPY[lang].subject;

  const html = buildOrderNotificationHtml(params);

  const { data, error } = await resend.emails.send({
    from,
    to: params.recipient_email,
    subject,
    html,
  });

  if (error) {
    logger.error({ err: error }, "Resend failed to send order notification");
    return { error };
  }

  logger.info(
    { orderId: params.order_id, emailId: data?.id, to: params.recipient_email },
    "Order notification email sent"
  );
  return { id: data!.id };
}
