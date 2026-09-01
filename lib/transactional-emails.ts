import { sendEmail } from "@/lib/email";
import {
  memberDecisionEmail,
  donationReceiptEmail,
  paymentFailureEmail,
  paymentReceiptEmail,
  reservationCancellationEmail,
  reservationConfirmationEmail,
} from "@/lib/email-templates";
import { siteOrigin } from "@/lib/site-url";

export async function sendMemberDecisionEmail(params: {
  email: string;
  memberName: string;
  status: "approved" | "rejected";
}) {
  const site = siteOrigin();
  const approved = params.status === "approved";
  return sendEmail({
    to: params.email,
    subject: approved ? "Tu membresía en Natán Torá fue aprobada" : "Actualización de tu solicitud de membresía",
    html: memberDecisionEmail({ memberName: params.memberName, status: params.status, siteUrl: approved ? `${site}/auth/login` : site }),
    text: approved
      ? `Hola ${params.memberName}. Tu solicitud fue aprobada. Ya puedes entrar en ${site}/auth/login`
      : `Hola ${params.memberName}. Por el momento tu solicitud de membresía no fue aprobada. Si consideras que hubo un error, responde a este correo.`,
  });
}

type ReservationEmailData = {
  email: string;
  memberName: string;
  eventId: string;
  eventTitle: string;
  eventDate: Date | string;
  location: string;
  seats: string[];
  quantity: number;
  total: number;
};

export async function sendReservationConfirmation(params: ReservationEmailData) {
  const eventUrl = `${siteOrigin()}/eventos/${params.eventId}`;
  return sendEmail({
    to: params.email,
    subject: `Reservación confirmada — ${params.eventTitle}`,
    html: reservationConfirmationEmail({ ...params, eventUrl }),
    text: `Tu reservación para ${params.eventTitle} está confirmada. Fecha: ${new Date(params.eventDate).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}. Lugares: ${params.seats.join(", ") || "lugar libre"}.`,
  });
}

export async function sendReservationCancellation(params: ReservationEmailData) {
  return sendEmail({
    to: params.email,
    subject: `Reservación cancelada — ${params.eventTitle}`,
    html: reservationCancellationEmail({ ...params, eventUrl: `${siteOrigin()}/eventos` }),
    text: `Tu reservación para ${params.eventTitle} fue cancelada por la administración.`,
  });
}

export async function sendPaymentReceipt(params: {
  email: string;
  memberName: string;
  amount: number;
  method: "cash" | "stripe" | "mercadopago";
  concepts: string[];
  remainingBalance: number;
  paidAt?: Date | string;
}) {
  return sendEmail({
    to: params.email,
    subject: `Pago recibido — ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(params.amount)}`,
    html: paymentReceiptEmail({ ...params, accountUrl: `${siteOrigin()}/mi-cuenta` }),
    text: `Recibimos tu pago por ${params.amount.toFixed(2)} MXN. Saldo pendiente: ${params.remainingBalance.toFixed(2)} MXN.`,
  });
}

export async function sendDonationReceipt(params: {
  email: string;
  donorName: string;
  amount: number;
  purpose: string;
  recurring: boolean;
  paidAt?: Date | string;
}) {
  return sendEmail({
    to: params.email,
    subject: `Gracias por tu donativo — ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(params.amount)}`,
    html: donationReceiptEmail({ ...params, siteUrl: `${siteOrigin()}/donativos` }),
    text: `Gracias por tu donativo de ${params.amount.toFixed(2)} MXN para ${params.purpose}.`,
  });
}

export async function sendPaymentFailure(params: {
  email: string;
  memberName: string;
  amount: number;
  description: string;
  details: string[];
  retryPath: string;
}) {
  return sendEmail({
    to: params.email,
    subject: `Pago no completado — ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(params.amount)}`,
    html: paymentFailureEmail({ ...params, retryUrl: `${siteOrigin()}${params.retryPath}` }),
    text: `Hola ${params.memberName}. Tu pago de ${params.amount.toFixed(2)} MXN por ${params.description} no pudo confirmarse. No registramos el pago. Puedes intentarlo nuevamente en ${siteOrigin()}${params.retryPath}`,
  });
}
