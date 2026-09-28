begin;
-- Durable send claims and snapshots for the existing Resend channel.
-- Installation sends no mail and changes no existing order.
create table public.print_order_notifications (
  order_id uuid not null references public.print_orders(id),
  event_key text not null,
  kind text not null check (kind in ('paid','delayed','accepted','shipped','cancelled','refunded','studio')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','accepted','failed','uncertain')),
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  completed_at timestamptz,
  provider_message_id text,
  primary key(order_id,event_key)
);
alter table public.print_order_notifications enable row level security;
revoke all on public.print_order_notifications from public,anon,authenticated;
grant select,insert,update on public.print_order_notifications to service_role;
commit;
