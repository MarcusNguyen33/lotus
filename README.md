# LotUS

Vietnamese storefront for ordering US products for delivery to Vietnam.

## Features
- Responsive lotus pink, cream, and green storefront
- Product categories, search, sorting, and product details
- Shopping cart and guest order requests
- Persistent products and orders in the owner's Supabase database
- Private order tracking codes
- Owner-only product editing and shipment updates

The catalog uses existing Supabase products, with prices in USD. Manage inventory from `/admin`.
After the owner sets the final shipping/other fees and marks an order `Đã xác nhận`, customers can open Stripe hosted test checkout from private order tracking. This deployment accepts test keys only and does not collect real money. Verified Stripe webhooks update the payment status; tracking also refreshes it directly from Stripe.

The quote is locked once checkout starts to prevent price changes during payment. Pending payments cannot be canceled or repriced in the admin screen; resolve those cases in Stripe before making further changes. Do not fulfill orders based on sandbox payments.

## Development
Requires Node 22.13 or later. Run `npm ci`, then `npm run dev`. Copy `.env.example` to `.env` and configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` on the server only. The compatibility migration in `supabase/migrations/20260922_lotus_integration.sql` adds tracking fields to the existing tables without removing records. Apply it to the intended Supabase project before using order creation.

Portable development simulates sign-in as `seedy@sites.test`; set local `OWNER_EMAIL` to that address to test management. Use the real owner's email in the hosted environment. Never use the local test identity for production.

Set `OWNER_EMAIL` to the owner's authenticated email in the hosting environment. Production authentication uses Sites sign-in; customers can browse and submit orders without an account. Never expose this environment value through client code.

## Deployment
The application runs on Sites with Cloudflare Workers and Supabase. GitHub Pages cannot run the server-side order APIs. Set `OWNER_EMAIL`, `SUPABASE_URL`, and secret `SUPABASE_SECRET_KEY` in the hosting environment before publishing. Use the published Sites URL to share the working store.

For test checkout, set encrypted `STRIPE_RESTRICTED_KEY` (restricted test key with Checkout Sessions read/write access and the permissions needed for inline prices) and `STRIPE_WEBHOOK_SECRET`. Register `/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Never commit keys. Live payments require a separate launch configuration and review.

## Sample photography
Unsplash photos by Kadarius Seegars, Maria Sime, Rahul Bhogal, and Joan Tran. Photos are illustrative and do not establish product specifications or available stock.
