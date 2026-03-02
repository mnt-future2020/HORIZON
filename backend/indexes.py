import logging

logger = logging.getLogger("horizon.indexes")


async def ensure_indexes(db):
    """Create indexes if they don't exist. Safe to call multiple times."""
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone")

    await db.venues.create_index("id", unique=True)
    await db.venues.create_index("slug", unique=True, sparse=True)
    await db.venues.create_index("owner_id")
    await db.venues.create_index([("city", 1), ("status", 1)])

    await db.bookings.create_index([("venue_id", 1), ("date", 1), ("status", 1)])
    await db.bookings.create_index("host_id")
    await db.bookings.create_index("razorpay_order_id", sparse=True)
    await db.bookings.create_index([("status", 1), ("expires_at", 1)])

    await db.pricing_rules.create_index([("venue_id", 1), ("is_active", 1)])

    await db.coaching_sessions.create_index([("coach_id", 1), ("status", 1)])

    await db.social_posts.create_index([("created_at", -1)])
    await db.social_posts.create_index("user_id")
    await db.social_posts.create_index(
        [("content", "text"), ("tags", "text")],
        name="post_text_search", default_language="english"
    )
    await db.social_likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.social_reactions.create_index([("post_id", 1), ("user_id", 1)], unique=True)

    await db.users.create_index(
        [("name", "text"), ("username", "text")],
        name="user_text_search", default_language="english"
    )
    await db.venues.create_index(
        [("name", "text"), ("area", "text"), ("city", "text")],
        name="venue_text_search", default_language="english"
    )

    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)

    await db.notifications.create_index([("user_id", 1), ("is_read", 1), ("created_at", -1)])

    await db.reviews.create_index([("venue_id", 1), ("created_at", -1)])

    await db.rating_history.create_index([("user_id", 1), ("seq", -1)])

    await db.direct_messages.create_index([("conversation_id", 1), ("created_at", -1)])

    await db.bookmarks.create_index([("post_id", 1), ("user_id", 1)], unique=True)

    logger.info("MongoDB indexes ensured")
