import { timingSafeEqual } from "crypto";

export function verifyDashboardPassword(input: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected) {
    return false;
  }

  const provided = Buffer.from(input);
  const target = Buffer.from(expected);

  if (provided.length !== target.length) {
    return false;
  }

  return timingSafeEqual(provided, target);
}