-- Auto welcome on fan signup (Josh 7/24). Applied to prod as
-- fan_welcome_tracking + fan_welcome_trigger.
alter table fan_signups
  add column if not exists welcomed_at timestamptz,
  add column if not exists welcome_status text;

-- AFTER INSERT (new.id exists; runs after fan_signup_to_contact BEFORE trigger)
-- calls the fan-welcome edge fn via pg_net. Email sends via Resend when
-- RESEND_API_KEY is set; SMS queues (sms_pending) until Twilio is wired.
create or replace function public.trigger_fan_welcome()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare anon_jwt text;
begin
  select secret into anon_jwt from cron_secrets where name = 'supabase_anon_jwt' limit 1;
  perform net.http_post(
    url := 'https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/fan-welcome',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || coalesce(anon_jwt,''),
      'apikey', coalesce(anon_jwt,'')
    ),
    body := jsonb_build_object('fan_signup_id', new.id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_fan_welcome on fan_signups;
create trigger trg_fan_welcome
  after insert on fan_signups
  for each row execute function public.trigger_fan_welcome();
