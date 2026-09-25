create extension if not exists pg_cron;

insert into public.sources (category_id, name, slug, source_type, provider, base_url, prompt_template, rights_notes, priority, is_enabled)
select c.id, v.name, v.slug, 'evergreen'::public.source_type_enum, v.provider, v.base_url, v.prompt_template,
       'Evergreen editorial seed using stable institutional references. No scraping or republication.', 5, true
from public.categories c
join (values
  ('health','Health Systems Evergreen','health-systems-evergreen','WHO','https://www.who.int/','Write an evergreen health explainer about human health, medicine, prevention, public health, or health systems.'),
  ('sports','Sports Systems Evergreen','sports-systems-evergreen','IOC','https://olympics.com/ioc','Write an evergreen sports explainer about competition, performance, governance, training, infrastructure, or the economics and culture of sport.'),
  ('politics','Civic Institutions Evergreen','civic-institutions-evergreen','International IDEA','https://www.idea.int/','Write a neutral evergreen politics explainer about law, institutions, governance, elections, diplomacy, public administration, or constitutional systems.'),
  ('entertainment','Culture and Media Evergreen','culture-media-evergreen','UNESCO','https://www.unesco.org/en/culture','Write an evergreen entertainment explainer about film, television, music, social media, creator economies, audiences, or cultural production.'),
  ('education','Education Systems Evergreen','education-systems-evergreen','UNESCO','https://www.unesco.org/en/education','Write an evergreen education explainer about learning, schools, universities, skills, pedagogy, access, or education systems.'),
  ('food','Food Systems Evergreen','food-systems-evergreen','FAO','https://www.fao.org/','Write an evergreen food explainer about nutrition, agriculture, ingredients, food systems, culinary practice, supply chains, or consumer food culture.'),
  ('history','Historical Systems Evergreen','historical-systems-evergreen','Smithsonian','https://www.si.edu/','Write an evergreen history explainer about civilizations, institutions, technology, culture, trade, archaeology, or historical change.')
) as v(category_slug,name,slug,provider,base_url,prompt_template)
  on v.category_slug = c.slug
on conflict (slug) do update
set is_enabled = true,
    base_url = excluded.base_url,
    prompt_template = excluded.prompt_template,
    updated_at = now();

update public.system_state
set mode = 'running',
    daily_target = 80,
    per_category_max = 1
where id = 1;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'blogdel-every-three-hours') then
    perform cron.unschedule('blogdel-every-three-hours');
  end if;
end $$;

select cron.schedule(
  'blogdel-every-three-hours',
  '0 */3 * * *',
  $job$
  select net.http_post(
    url := 'https://blogdel.blog/api/public/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_TOKEN' order by created_at desc limit 1)
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 300000
  ) as request_id;
  $job$
);
