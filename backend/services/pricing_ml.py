"""
ML Dynamic Pricing Service
Uses historical booking data to predict demand and suggest optimal prices.
Falls back to rule-based pricing when insufficient data or model unavailable.
"""
import logging
import pickle
import os
from datetime import datetime, timezone, timedelta
from database import db
import math

logger = logging.getLogger("horizon")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "pricing_model.pkl")
MIN_TRAINING_SAMPLES = 50  # Minimum bookings needed to train

# Feature engineering constants
HOUR_FEATURES = 24
DAY_FEATURES = 7


class DemandPredictor:
    """Random Forest based demand predictor for venue slot pricing."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.is_trained = False
        self._load_model()

    def _load_model(self):
        """Load pre-trained model from disk if available."""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                    self.model = data.get("model")
                    self.scaler = data.get("scaler")
                    self.is_trained = True
                    logger.info("ML pricing model loaded from disk")
            except Exception as e:
                logger.warning(f"Failed to load pricing model: {e}")

    def _save_model(self):
        """Save trained model to disk."""
        try:
            with open(MODEL_PATH, "wb") as f:
                pickle.dump({"model": self.model, "scaler": self.scaler}, f)
            logger.info("ML pricing model saved to disk")
        except Exception as e:
            logger.error(f"Failed to save pricing model: {e}")

    @staticmethod
    def _extract_features(booking: dict) -> list:
        """Extract feature vector from a booking record."""
        try:
            date_obj = datetime.strptime(booking.get("date", "2025-01-01"), "%Y-%m-%d")
            hour = int(booking.get("start_time", "12:00").split(":")[0])
        except (ValueError, IndexError):
            date_obj = datetime.now()
            hour = 12

        dow = date_obj.weekday()
        month = date_obj.month
        is_weekend = 1 if dow >= 5 else 0

        # Cyclical encoding for hour and day
        hour_sin = math.sin(2 * math.pi * hour / HOUR_FEATURES)
        hour_cos = math.cos(2 * math.pi * hour / HOUR_FEATURES)
        dow_sin = math.sin(2 * math.pi * dow / DAY_FEATURES)
        dow_cos = math.cos(2 * math.pi * dow / DAY_FEATURES)
        month_sin = math.sin(2 * math.pi * month / 12)
        month_cos = math.cos(2 * math.pi * month / 12)

        return [
            hour, dow, month, is_weekend,
            hour_sin, hour_cos, dow_sin, dow_cos,
            month_sin, month_cos,
            booking.get("turf_number", 1),
        ]

    async def train(self, venue_id: str):
        """Train the model on historical booking data for a venue."""
        try:
            from sklearn.ensemble import RandomForestRegressor
            from sklearn.preprocessing import StandardScaler
            import numpy as np
        except ImportError:
            logger.warning("scikit-learn not installed, ML pricing unavailable")
            return False

        # Fetch historical bookings
        bookings = await db.bookings.find(
            {"venue_id": venue_id, "status": "confirmed"},
            {"_id": 0, "date": 1, "start_time": 1, "turf_number": 1, "total_amount": 1}
        ).to_list(5000)

        if len(bookings) < MIN_TRAINING_SAMPLES:
            logger.info(f"Insufficient data for ML training: {len(bookings)} < {MIN_TRAINING_SAMPLES}")
            return False

        # Build feature matrix
        X = []
        y = []
        for b in bookings:
            features = self._extract_features(b)
            X.append(features)
            y.append(b.get("total_amount", 2000))

        X = np.array(X)
        y = np.array(y)

        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # Train Random Forest
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42
        )
        self.model.fit(X_scaled, y)
        self.is_trained = True
        self._save_model()

        logger.info(f"ML pricing model trained for {venue_id} with {len(bookings)} samples")
        return True

    async def predict_price(self, venue_id: str, date: str, start_time: str, turf_number: int, base_price: int) -> dict:
        """Predict optimal price for a slot."""
        if not self.is_trained:
            return {
                "suggested_price": base_price,
                "confidence": 0,
                "method": "base_price",
                "demand_level": "unknown"
            }

        try:
            import numpy as np
        except ImportError:
            return {
                "suggested_price": base_price,
                "confidence": 0,
                "method": "base_price",
                "demand_level": "unknown"
            }

        booking_data = {
            "date": date,
            "start_time": start_time,
            "turf_number": turf_number
        }
        features = self._extract_features(booking_data)
        features_scaled = self.scaler.transform([features])

        # Get prediction and confidence from tree variance
        predictions = [tree.predict(features_scaled)[0] for tree in self.model.estimators_]
        predicted_price = int(round(sum(predictions) / len(predictions)))
        std_dev = float(np.std(predictions))
        mean_pred = float(np.mean(predictions))
        confidence = max(0, min(100, int(100 * (1 - std_dev / max(mean_pred, 1)))))

        # Determine demand level
        ratio = predicted_price / max(base_price, 1)
        if ratio > 1.3:
            demand_level = "high"
        elif ratio > 1.1:
            demand_level = "medium"
        elif ratio < 0.85:
            demand_level = "low"
        else:
            demand_level = "normal"

        # Clamp price to reasonable bounds (50% - 200% of base)
        min_price = int(base_price * 0.5)
        max_price = int(base_price * 2.0)
        suggested_price = max(min_price, min(max_price, predicted_price))

        return {
            "suggested_price": suggested_price,
            "confidence": confidence,
            "method": "ml_random_forest",
            "demand_level": demand_level,
            "base_price": base_price,
            "price_multiplier": round(suggested_price / max(base_price, 1), 2)
        }


# Singleton instance
demand_predictor = DemandPredictor()


async def get_ml_price(venue_id: str, date: str, start_time: str, turf_number: int = 1) -> dict:
    """Get ML-suggested price for a slot."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "base_price": 1})
    if not venue:
        return {"error": "Venue not found"}

    base_price = venue.get("base_price", 2000)
    return await demand_predictor.predict_price(venue_id, date, start_time, turf_number, base_price)


async def train_venue_model(venue_id: str) -> bool:
    """Train the ML model for a specific venue."""
    return await demand_predictor.train(venue_id)


async def get_demand_forecast(venue_id: str, date: str) -> list:
    """Get demand forecast for all slots on a given date."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return []

    base_price = venue.get("base_price", 2000)
    forecasts = []

    for hour in range(venue.get("opening_hour", 6), venue.get("closing_hour", 23)):
        start_time = f"{hour:02d}:00"
        for turf in range(1, venue.get("turfs", 1) + 1):
            prediction = await demand_predictor.predict_price(
                venue_id, date, start_time, turf, base_price
            )
            forecasts.append({
                "start_time": start_time,
                "turf_number": turf,
                **prediction
            })

    return forecasts
