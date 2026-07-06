import { supabase } from "./supabase";
import { PlantKey, AdminRow, AdminOverall } from "./types";
import { getProductionMonth } from "./api";

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_admin_passcode", { passcode });
  if (error) throw error;
  return data as boolean;
}

export async function getAdminRates(passcode: string, plant: PlantKey): Promise<{ rate: number; dedBoth: number }> {
  const { data, error } = await supabase.rpc("get_admin_rates", { passcode, plant_key: plant });
  if (error) throw new Error(error.message.includes("Incorrect passcode") ? "Incorrect passcode." : error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { rate: Number(row.rate), dedBoth: Number(row.ded_both) };
}

export async function updateAdminSettings(input: {
  currentPasscode: string;
  newPasscode?: string;
  oldRp?: { rate: number; dedBoth: number };
  newRp?: { rate: number; dedBoth: number };
}): Promise<void> {
  const { error } = await supabase.rpc("update_admin_settings", {
    current_passcode: input.currentPasscode,
    new_passcode: input.newPasscode ?? null,
    p_old_rate: input.oldRp?.rate ?? null,
    p_old_ded_both: input.oldRp?.dedBoth ?? null,
    p_new_rate: input.newRp?.rate ?? null,
    p_new_ded_both: input.newRp?.dedBoth ?? null,
  });
  if (error) throw new Error(error.message.includes("incorrect") ? "Current password is incorrect." : error.message);
}

export async function clearAllData(passcode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("clear_all_data", { passcode });
  if (error) throw new Error(error.message.includes("Incorrect passcode") ? "Incorrect passcode." : error.message);
  return data as boolean;
}


/**
 * Rates come from the passcode-gated RPC; the day-by-day production numbers
 * are ordinary (non-sensitive) data the anon key can already read. Combining
 * them client-side keeps the SQL layer tiny.
 */
export async function getAdminReport(
  passcode: string, plant: PlantKey, year: number, month: number
): Promise<{ rows: AdminRow[]; overall: AdminOverall; rate: number; dedBoth: number; dedOne: number }> {
  const { rate, dedBoth } = await getAdminRates(passcode, plant);
  const dedOne = dedBoth / 2;
  const monthData = await getProductionMonth(plant, year, month);

  const rows: AdminRow[] = monthData.map(({ day, date, entry }) => {
    const shiftA = entry && !entry.shift_a?.stopped
      ? entry.shift_a.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      : null;
    const shiftB = entry && !entry.shift_b?.stopped
      ? entry.shift_b.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0)
      : null;
    const shiftsRan = (shiftA !== null ? 1 : 0) + (shiftB !== null ? 1 : 0);
    const totalProduction = (shiftA || 0) + (shiftB || 0);
    const totalAmount = totalProduction * rate;
    const deduction = shiftsRan === 2 ? dedBoth : shiftsRan === 1 ? dedOne : 0;
    const balance = totalAmount - deduction;
    return { day, date, shiftA, shiftB, totalProduction, totalAmount, balance, shiftsRan };
  });

  const overall = rows.reduce(
    (acc, r) => ({
      production: acc.production + r.totalProduction,
      amount: acc.amount + r.totalAmount,
      balance: acc.balance + r.balance,
    }),
    { production: 0, amount: 0, balance: 0 }
  );

  return { rows, overall, rate, dedBoth, dedOne };
}
