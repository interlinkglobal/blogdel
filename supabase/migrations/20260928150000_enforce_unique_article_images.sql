with ranked_images as (
  select
    id,
    featured_image_url,
    row_number() over (
      partition by featured_image_url
      order by published_at asc nulls last, created_at asc, id asc
    ) as usage_rank
  from public.articles
  where featured_image_url is not null
    and featured_image_url not like '/fallback-images/%'
    and featured_image_url <> '/editorial-fallback.svg'
)
update public.articles as article
set
  featured_image_url = null,
  featured_image_alt = article.title,
  image_source_type = 'category-fallback',
  image_provider = 'blogdel',
  image_model = null
from ranked_images
where article.id = ranked_images.id
  and ranked_images.usage_rank > 1;

create unique index if not exists articles_unique_nonfallback_featured_image_url
on public.articles (featured_image_url)
where featured_image_url is not null
  and featured_image_url not like '/fallback-images/%'
  and featured_image_url <> '/editorial-fallback.svg';
