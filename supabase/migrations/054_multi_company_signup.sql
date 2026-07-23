-- 054: รองรับสำนักงานบัญชี/เจ้าของหลายกิจการ — เจ้าของ 1 คนมีได้สูงสุด 20 กิจการ (apply แล้ว)
create or replace function public.enforce_shop_signup()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_email text; v_norm text; v_domain text; v_count int;
begin
  select email into v_email from profiles where id = new.owner_id;
  if v_email is null or v_email = '' then return new; end if;
  v_norm := public.normalize_email(v_email);
  v_domain := split_part(v_norm, '@', 2);
  if exists (select 1 from blocked_email_domains where domain = v_domain) then
    raise exception 'disposable_email' using errcode = 'P0001';
  end if;
  select count(*) into v_count from shops s join profiles pr on pr.id = s.owner_id
    where s.id <> new.id and public.normalize_email(pr.email) = v_norm;
  if v_count >= 20 then
    raise exception 'duplicate_signup' using errcode = 'P0001';
  end if;
  return new;
end $function$;
