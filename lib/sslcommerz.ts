/**
 * Minimal SSLCommerz SANDBOX integration.
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * Sandbox credentials are free — sign up at https://developer.sslcommerz.com/registration/
 * and put the store_id / store_passwd into .env.local (see .env.example).
 *
 * This demo never touches real money: SSLCOMMERZ_BASE_URL points at the
 * sandbox host, so all transactions are simulated test transactions.
 */

const SSLCOMMERZ_BASE_URL =
  process.env.SSLCOMMERZ_BASE_URL || "https://sandbox.sslcommerz.com";

interface InitPaymentParams {
  tranId: string;
  amountBdt: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export async function initSslcommerzPayment(params: InitPaymentParams) {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWORD;

  if (!storeId || !storePasswd) {
    throw new Error(
      "Missing SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD in env. " +
        "Get free sandbox credentials at https://developer.sslcommerz.com/registration/"
    );
  }

  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePasswd,
    total_amount: params.amountBdt.toString(),
    currency: "BDT",
    tran_id: params.tranId,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    cancel_url: params.cancelUrl,
    ipn_url: params.ipnUrl,
    cus_name: params.customerName,
    cus_email: params.customerEmail,
    cus_phone: params.customerPhone,
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: "Doctor Appointment Fee",
    product_category: "Healthcare",
    product_profile: "general",
  });

  const res = await fetch(`${SSLCOMMERZ_BASE_URL}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`SSLCommerz init failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== "SUCCESS") {
    throw new Error(`SSLCommerz rejected init: ${JSON.stringify(data)}`);
  }

  // data.GatewayPageURL is where the browser should redirect to for checkout
  return data as { status: string; GatewayPageURL: string; sessionkey: string };
}

export async function validateSslcommerzTransaction(valId: string) {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWORD;

  const url = `${SSLCOMMERZ_BASE_URL}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
    valId
  )}&store_id=${storeId}&store_passwd=${storePasswd}&format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`SSLCommerz validation failed: ${res.status}`);
  return res.json();
}
