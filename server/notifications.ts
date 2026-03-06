import twilio from "twilio";
import { storage } from "./storage";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const defaultCountryCode = process.env.TWILIO_DEFAULT_COUNTRY_CODE || "+91";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!accountSid || !authToken) return null;
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

export function getSmsConfigStatus() {
  const clientReady = !!getTwilioClient();
  const usingMessagingService = !!messagingServiceSid;
  const fromConfigured = !!fromNumber;
  return {
    configured: clientReady && (usingMessagingService || fromConfigured),
    clientReady,
    usingMessagingService,
    fromConfigured,
  };
}

export function normalizePhoneE164(input: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (s.startsWith("+")) {
    const digits = s.replace(/[^\d+]/g, "");
    return /^\+\d{7,15}$/.test(digits) ? digits : null;
  }
  const digitsOnly = s.replace(/\D/g, "");
  if (!digitsOnly) return null;
  const local = digitsOnly.replace(/^0+/, "");
  const result = `${defaultCountryCode}${local}`;
  return /^\+\d{7,15}$/.test(result) ? result : null;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  if (!client) return;
  const from = messagingServiceSid ? undefined : fromNumber;
  if (!messagingServiceSid && !from) return;
  try {
    await client.messages.create({
      ...(messagingServiceSid ? { messagingServiceSid } : { from }),
      to,
      body,
    });
  } catch (err) {
    // swallow errors to avoid breaking alert flow
    console.error("[SMS] Failed to send:", (err as Error).message);
  }
}

export async function notifyUserBySms(
  userId: number,
  title: string,
  message: string
): Promise<void> {
  const client = getTwilioClient();
  if (!client) return;
  try {
    const user = await storage.getUser(userId);
    const normalized = user?.phone ? normalizePhoneE164(user.phone) : null;
    if (!normalized) return;
    const body = `${title} - ${message}`;
    await sendSms(normalized, body);
  } catch (err) {
    console.error("[SMS] Failed to notify user:", (err as Error).message);
  }
}
