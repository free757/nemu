import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

async function runSync() {
  // 1. Fetch active API credentials
  const { data: credentials, error: credsError } = await supabase
    .from("atlas_api_credentials")
    .select("*")
    .eq("is_active", true);

  if (credsError) throw credsError;

  if (!credentials || credentials.length === 0) {
    return {
      success: true,
      message: "No active API credentials found.",
      syncedAccountsCount: 0,
      newPaymentsCount: 0,
      logs: ["No active API credentials found in database."],
    };
  }

  // 2. Fetch all accounts with registered wallet addresses to match incoming deposits
  const { data: accounts, error: accountsError } = await supabase
    .from("atlas_accounts")
    .select("*")
    .not("wallet_address", "is", null);

  if (accountsError) throw accountsError;

  // Normalizing addresses for matching (lowercased, trimmed)
  const addressToAccountMap = new Map();
  accounts?.forEach((acc) => {
    if (acc.wallet_address) {
      addressToAccountMap.set(acc.wallet_address.trim().toLowerCase(), acc);
    }
  });

  let newPaymentsCount = 0;
  const logs: string[] = [];

  // 3. Process each API credentials entry
  for (const cred of credentials) {
    const { platform, account_label, api_key, secret_key, passphrase } = cred;
    logs.push(`Starting sync for ${account_label} (${platform})...`);

    try {
      let deposits: Array<{
        amount: number;
        address: string;
        txId: string;
        insertTime: number; // millisecond timestamp
      }> = [];

      if (platform === "binance") {
        const timestamp = Date.now();
        const recvWindow = 60000;
        const query = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
        const signature = crypto
          .createHmac("sha256", secret_key)
          .update(query)
          .digest("hex");

        const url = `https://api.binance.com/sapi/v1/capital/deposit/hisrec?${query}&signature=${signature}`;
        const res = await fetch(url, {
          headers: {
            "X-MBX-APIKEY": api_key,
          },
          next: { revalidate: 0 }, // disable caching
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Binance API error (HTTP ${res.status}): ${errText}`);
        }

        const rawDeposits = await res.json();
        if (Array.isArray(rawDeposits)) {
          deposits = rawDeposits.map((d: any) => ({
            amount: parseFloat(d.amount),
            address: d.address,
            txId: d.txId,
            insertTime: d.insertTime,
          }));
        } else {
          logs.push(`⚠️ Binance API returned unexpected structure for ${account_label}: ${JSON.stringify(rawDeposits)}`);
        }
      } else if (platform === "okx") {
        // OKX API signing
        const timestamp = new Date().toISOString(); // ISO 8601 UTC
        const method = "GET";
        const requestPath = "/api/v5/asset/deposit-history";
        const prehash = timestamp + method + requestPath;
        const signature = crypto
          .createHmac("sha256", secret_key)
          .update(prehash)
          .digest("base64");

        const url = `https://www.okx.com${requestPath}`;
        const res = await fetch(url, {
          headers: {
            "OK-ACCESS-KEY": api_key,
            "OK-ACCESS-SIGN": signature,
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": passphrase || "",
            "Content-Type": "application/json",
          },
          next: { revalidate: 0 }, // disable caching
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OKX API error (HTTP ${res.status}): ${errText}`);
        }

        const rawData = await res.json();
        if (rawData.code === "0" && Array.isArray(rawData.data)) {
          deposits = rawData.data.map((d: any) => ({
            amount: parseFloat(d.amt),
            address: d.to,
            txId: d.txId,
            insertTime: parseInt(d.ts), // timestamp in milliseconds
          }));
        } else {
          throw new Error(`OKX API returned error code ${rawData.code}: ${rawData.msg}`);
        }
      }

      logs.push(`Fetched ${deposits.length} deposits from ${account_label}. Matching addresses...`);

      // 4. Match and log transactions
      for (const dep of deposits) {
        const normAddress = dep.address.trim().toLowerCase();
        const matchingAccount = addressToAccountMap.get(normAddress);

        if (matchingAccount) {
          // Find if this transaction has already been logged
          const { data: existing, error: findError } = await supabase
            .from("atlas_payments")
            .select("id")
            .eq("tx_id", dep.txId)
            .maybeSingle();

          if (findError) {
            logs.push(`⚠️ Error searching for existing tx_id ${dep.txId}: ${findError.message}`);
            continue;
          }

          if (!existing) {
            // Log the payment
            const dateStr = new Date(dep.insertTime).toLocaleString("ar-EG");
            const { error: insertError } = await supabase
              .from("atlas_payments")
              .insert([
                {
                  worker_id: matchingAccount.worker_id,
                  amount: dep.amount,
                  payout_method: "USDT",
                  wallet_address: dep.address,
                  tx_id: dep.txId,
                  notes: `إيداع تلقائي بقيمة ${dep.amount} USDT على حساب [${matchingAccount.account_name}] عبر ${platform.toUpperCase()} (${account_label}) بتاريخ ${dateStr}`,
                  exchange_rate: 1, // Default rate
                  amount_egp: dep.amount, // Default converted to EGP 1:1
                },
              ]);

            if (insertError) {
              logs.push(`⚠️ Failed to log payment for tx_id ${dep.txId}: ${insertError.message}`);
            } else {
              newPaymentsCount++;
              logs.push(`✅ Automatically logged ${dep.amount} USDT payment to worker for account [${matchingAccount.account_name}]`);

              // Update the amount_paid in atlas_accounts
              const newAmountPaid = Number(matchingAccount.amount_paid || 0) + dep.amount;
              const { error: updateError } = await supabase
                .from("atlas_accounts")
                .update({ amount_paid: newAmountPaid })
                .eq("id", matchingAccount.id);

              if (updateError) {
                logs.push(`⚠️ Failed to update amount_paid for account ${matchingAccount.account_name}: ${updateError.message}`);
              } else {
                // Keep local map updated in case of multiple deposits to same address in one run
                matchingAccount.amount_paid = newAmountPaid;
              }
            }
          }
        }
      }
    } catch (err: any) {
      logs.push(`❌ Failed to sync ${account_label}: ${err.message || err}`);
      console.error(`Sync error for ${account_label}:`, err);
    }
  }

  return {
    success: true,
    syncedAccountsCount: credentials.length,
    newPaymentsCount,
    logs,
  };
}

export async function POST() {
  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Sync Deposits API Error (POST):", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to synchronize deposits." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Sync Deposits API Error (GET):", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to synchronize deposits." },
      { status: 500 }
    );
  }
}
