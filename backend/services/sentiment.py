"""
NLP Sentiment Analysis Service for Reviews
Uses TextBlob for lightweight sentiment analysis.
Falls back to keyword-based analysis if TextBlob not available.
"""
import logging
import re

logger = logging.getLogger("horizon")

# Try to import TextBlob
try:
    from textblob import TextBlob
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False
    logger.info("TextBlob not installed, using keyword-based sentiment analysis")


# Keyword-based fallback
POSITIVE_WORDS = {
    "great", "excellent", "amazing", "awesome", "fantastic", "wonderful",
    "perfect", "love", "loved", "best", "good", "nice", "clean", "well",
    "maintained", "friendly", "professional", "recommended", "superb",
    "brilliant", "outstanding", "top", "smooth", "comfortable", "beautiful",
    "spacious", "quality", "value", "worth", "enjoyed", "happy", "satisfied"
}

NEGATIVE_WORDS = {
    "bad", "terrible", "awful", "horrible", "worst", "poor", "dirty",
    "broken", "rude", "expensive", "overpriced", "disappointed", "waste",
    "never", "avoid", "mediocre", "crowded", "noisy", "unsafe", "dark",
    "smelly", "unprofessional", "late", "delay", "cancelled", "refuse",
    "disgusting", "pathetic", "scam", "fraud", "cheating"
}


def analyze_sentiment(text: str) -> dict:
    """
    Analyze sentiment of review text.
    Returns: {score, label, confidence, keywords}
    - score: float from -1.0 (very negative) to 1.0 (very positive)
    - label: 'positive', 'negative', or 'neutral'
    - confidence: 0-100
    - keywords: list of detected sentiment keywords
    """
    if not text or not text.strip():
        return {
            "score": 0.0,
            "label": "neutral",
            "confidence": 0,
            "keywords": []
        }

    if HAS_TEXTBLOB:
        return _analyze_textblob(text)
    else:
        return _analyze_keywords(text)


def _analyze_textblob(text: str) -> dict:
    """Analyze sentiment using TextBlob NLP."""
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity  # -1 to 1
    subjectivity = blob.sentiment.subjectivity  # 0 to 1

    if polarity > 0.1:
        label = "positive"
    elif polarity < -0.1:
        label = "negative"
    else:
        label = "neutral"

    # Confidence based on subjectivity and polarity strength
    confidence = int(min(100, abs(polarity) * 100 + subjectivity * 20))

    # Extract key phrases
    keywords = []
    words = set(text.lower().split())
    keywords.extend([w for w in words if w in POSITIVE_WORDS])
    keywords.extend([w for w in words if w in NEGATIVE_WORDS])

    return {
        "score": round(polarity, 3),
        "label": label,
        "confidence": confidence,
        "subjectivity": round(subjectivity, 3),
        "keywords": keywords[:10]
    }


def _analyze_keywords(text: str) -> dict:
    """Fallback keyword-based sentiment analysis."""
    text_lower = text.lower()
    words = set(re.findall(r'\b[a-z]+\b', text_lower))

    pos_matches = words & POSITIVE_WORDS
    neg_matches = words & NEGATIVE_WORDS

    pos_count = len(pos_matches)
    neg_count = len(neg_matches)
    total = pos_count + neg_count

    if total == 0:
        return {
            "score": 0.0,
            "label": "neutral",
            "confidence": 30,
            "keywords": []
        }

    score = (pos_count - neg_count) / max(total, 1)
    # Normalize to -1 to 1 range
    score = max(-1.0, min(1.0, score))

    if score > 0.15:
        label = "positive"
    elif score < -0.15:
        label = "negative"
    else:
        label = "neutral"

    confidence = int(min(100, total * 15 + abs(score) * 50))

    keywords = list(pos_matches) + list(neg_matches)

    return {
        "score": round(score, 3),
        "label": label,
        "confidence": confidence,
        "keywords": keywords[:10]
    }


async def get_venue_sentiment_summary(venue_id: str) -> dict:
    """Get aggregated sentiment analysis for a venue's reviews."""
    from database import db

    reviews = await db.reviews.find(
        {"venue_id": venue_id, "sentiment": {"$exists": True}},
        {"_id": 0, "sentiment": 1, "rating": 1}
    ).to_list(500)

    if not reviews:
        return {
            "total_analyzed": 0,
            "avg_sentiment_score": 0,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "top_positive_keywords": [],
            "top_negative_keywords": []
        }

    scores = []
    distribution = {"positive": 0, "neutral": 0, "negative": 0}
    pos_keywords = {}
    neg_keywords = {}

    for r in reviews:
        s = r.get("sentiment", {})
        scores.append(s.get("score", 0))
        label = s.get("label", "neutral")
        distribution[label] = distribution.get(label, 0) + 1

        for kw in s.get("keywords", []):
            if kw in POSITIVE_WORDS:
                pos_keywords[kw] = pos_keywords.get(kw, 0) + 1
            elif kw in NEGATIVE_WORDS:
                neg_keywords[kw] = neg_keywords.get(kw, 0) + 1

    avg_score = sum(scores) / len(scores) if scores else 0

    top_pos = sorted(pos_keywords.items(), key=lambda x: x[1], reverse=True)[:5]
    top_neg = sorted(neg_keywords.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_analyzed": len(reviews),
        "avg_sentiment_score": round(avg_score, 3),
        "sentiment_distribution": distribution,
        "top_positive_keywords": [{"word": w, "count": c} for w, c in top_pos],
        "top_negative_keywords": [{"word": w, "count": c} for w, c in top_neg]
    }
