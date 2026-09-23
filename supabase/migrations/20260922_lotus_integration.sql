begin;
-- Extend the owner's existing tables. Existing products and orders stay intact.
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.orders add column if not exists code text;
alter table public.orders add column if not exists token_hash text;
alter table public.orders add column if not exists request_id text;
alter table public.orders add column if not exists phone text not null default '';
alter table public.orders add column if not exists email text not null default '';
alter table public.orders add column if not exists note text not null default '';
alter table public.orders add column if not exists shipment text not null default '';
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists stripe_checkout_session_id text;
create unique index if not exists lotus_orders_code_unique on public.orders(code) where code is not null;
create unique index if not exists lotus_orders_request_unique on public.orders(request_id) where request_id is not null;
alter table public.products enable row level security;
alter table public.orders enable row level security;
-- Orders and product mutations are handled by the server, using the secret key.
revoke all on public.orders from anon, authenticated;
revoke insert,update,delete on public.products from anon, authenticated;
commit;
notify pgrst, 'reload schema';
