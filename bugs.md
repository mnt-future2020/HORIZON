1. Explore Regex Scan (Full Table Scan)
Problem:
User types "cricket" in search → MongoDB reads every single post and user document in the database to check if "cricket" is in the text. 1000 posts = 1000 reads. 1 million posts = 1 million reads. Gets slower as app grows.

Fix:
Add MongoDB text index on content, name fields. Then use $text: {$search: "cricket"} instead of $regex. MongoDB maintains a pre-built word index — like a book's index page vs reading every page.

Advantage:

Search goes from O(n) → O(log n)
100x faster at scale
Supports partial words, case-insensitive automatically
2. Affinity Map Recomputed Every Feed Load
Problem:
Every time a user opens "For You" feed → backend runs 5 DB queries to calculate who they're close to (follows, co-play history, interactions). If 100 users open feed simultaneously → 500 DB queries at once. This number never changes in 5 minutes but recalculates every single time.

Fix:
Store the result in Redis with a 10-minute TTL per user:


affinity:user123 → {result} expires in 10min
First load calculates. Next 10 loads use cache. Recalculates only when expired.

Advantage:

5 DB queries → 1 Redis read (microseconds vs milliseconds)
Feed loads 10x faster
DB pressure drops massively under traffic
3. Page-Based Pagination Shifts
Problem:
User scrolls feed, sees posts 1-20. While scrolling, 3 new posts are created. When user loads page 2 (posts 21-40) → those 3 new posts pushed everything down → user sees posts 18, 19, 20 again (duplicates) or misses posts entirely.

Fix:
Cursor-based pagination — instead of "give me page 2", client sends "give me posts older than this timestamp/ID":


GET /feed?before=2024-03-01T10:30:00
Advantage:

Zero duplicates while scrolling
Standard approach used by Instagram, Twitter
Consistent feed even with high post volume
4. Engagement Score Live Every Load
Problem:
Some page shows user engagement score (0-100). Every time that page loads → 8 separate DB queries run (posts this week, comments this week, likes given, reactions, stories, streaks...). If 50 users view profiles simultaneously → 400 DB queries at once. Score doesn't change every second but recalculates every view.

Fix:
Background job (APScheduler — already in the project) recalculates engagement scores every 30 minutes and stores result in user document. Page load just reads one field.

Advantage:

8 queries → 0 queries on page load
Score is "fresh enough" (30min lag is acceptable)
APScheduler already exists in the project — minimal code change
5. Player Card Live Every Load
Problem:
Player profile card shows stats: skill rating, win rate, tournament history, training score, reliability — pulled from 6-8 different collections every time someone views the card. View a popular player's profile → 8-10 queries per view. 100 people view → 1000 queries.

Fix:
Same approach as engagement score — background job pre-computes and caches in the user document every 1 hour:


user.cached_stats: {
  "overall_score": 78,
  "tier": "Gold",
  "win_rate": 0.65,
  "cached_at": "2024-03-01T10:00:00"
}
Advantage:

Profile load becomes instant (one document read)
Consistent stats — no flicker between requests
Batch compute for all users at once is cheaper than N individual loads
6. likes_count / comments_count Drift
Problem:
When you like a post, 2 things happen:

Insert into social_likes collection
Increment likes_count on the post
If step 1 succeeds but step 2 fails (network hiccup, server restart) → post shows 47 likes but actually 48 people liked it. Over time these numbers drift. No way to know which posts have wrong counts.

Fix:
Option A — MongoDB transactions (atomic: both succeed or both fail)
Option B — Reconciliation job (every night, count actual likes from social_likes collection and sync the counter)

Option B is simpler and works well enough for this use case.

Advantage:

Correct like/comment counts always shown
Trust in the numbers (matters for trending algorithm — trending is based on likes_count)
Without fix: a post with 100 real likes might show 87 → ranks lower than it should in trending
Summary:

Fix	Effort	Impact
Text index (regex)	Low	High — search speed
Affinity Redis cache	Low	High — feed speed
Cursor pagination	Medium	Medium — UX
Engagement score cache	Low	Medium — profile speed
Player card cache	Low	Medium — profile speed
likes_count reconciliation	Low	Medium — data accuracy
First 2 and last one I'd prioritize. Want me to fix them?