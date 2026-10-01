# Article quality standard

This document defines Blogdel's minimum quality checks for standard generated articles. These are internal editorial safeguards; they are not Google or AdSense word-count requirements.

## Length and structure

- Body length: at least **650 whitespace-delimited words**.
- Structure: at least **three Markdown level-two headings** (`##`) with nonempty titles.
- The threshold is a floor, not a target to pad toward. Each section should add useful, specific explanation relevant to the article's subject.

## Source evidence

An article must have enough evidence in its generation input to support its claims:

- Either a nonempty source-context summary at least **120 characters** long, or at least **three sourced facts**.
- Each sourced fact must have a claim of at least 20 characters and a `source_ref` URL present in the supplied reference set.
- At least **two source references** must be supplied.
- The generated article must preserve the supplied reference set: reference count must match, URLs must be distinct, and each URL must be HTTPS and present in the input. Do not fabricate source URLs or alter them during generation.

These checks validate the evidence fields and reference wiring. They do not independently verify that sources are authoritative, that a claim follows from its cited source, or that the article is useful. Editors still need to assess source quality, factual accuracy, relevance, and whether the article adds meaningful information.

## Recent topic overlap

Before an article can be auto-published, its title is compared with the **30 most recent published titles in the same category**. Titles are normalized to lowercase alphanumeric tokens of at least three characters, then compared using token-set Jaccard similarity. A score of **0.72 or higher** is considered recent overlap and fails the check. This is a title-similarity safeguard, not a full semantic comparison of article bodies.

## Publication behavior

The quality check returns failure reasons for unmet length, structure, evidence, reference, category, or recent-title requirements. When a check fails, a generated article remains in **review**; it must not be auto-published. A reviewer can evaluate it under the same editorial standard before taking a separate publication action.

The current evergreen cron generation path passes an empty context object to article generation. Because it supplies neither a qualifying summary nor sourced facts, generated articles on that path fail the evidence check and remain in review unless the generation input is updated to include source context or fact-level evidence. Category-level reference URLs alone do not satisfy this evidence requirement.

## Change control

Keep these documented thresholds aligned with `src/lib/article-quality.ts` and the publishing decision in `src/routes/api/public/cron/tick.ts`. Any threshold change should update this document and `/rules.md` together and include a review of the runtime gate. Do not describe these editorial thresholds as Google's requirements.
