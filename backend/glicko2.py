import math


# Glicko-2 constants
TAU = 0.5  # System volatility constraint
EPSILON = 0.000001
GLICKO2_SCALE = 173.7178  # Convert between Glicko-1 and Glicko-2


def rating_to_glicko2(rating):
    return (rating - 1500) / GLICKO2_SCALE


def rd_to_glicko2(rd):
    return rd / GLICKO2_SCALE


def glicko2_to_rating(mu):
    return mu * GLICKO2_SCALE + 1500


def glicko2_to_rd(phi):
    return phi * GLICKO2_SCALE


def g(phi):
    return 1 / math.sqrt(1 + 3 * phi ** 2 / math.pi ** 2)


def E(mu, mu_j, phi_j):
    return 1 / (1 + math.exp(-g(phi_j) * (mu - mu_j)))


def compute_variance(mu, opponents):
    """Compute estimated variance of the player's rating based on game outcomes."""
    total = 0.0
    for opp_mu, opp_phi, _ in opponents:
        g_val = g(opp_phi)
        e_val = E(mu, opp_mu, opp_phi)
        total += g_val ** 2 * e_val * (1 - e_val)
    if total == 0:
        return float('inf')
    return 1.0 / total


def compute_delta(mu, opponents, v):
    """Compute estimated improvement in rating."""
    total = 0.0
    for opp_mu, opp_phi, score in opponents:
        g_val = g(opp_phi)
        e_val = E(mu, opp_mu, opp_phi)
        total += g_val * (score - e_val)
    return v * total


def compute_new_volatility(sigma, phi, v, delta):
    """Iterative algorithm to compute new volatility (Illinois algorithm)."""
    a = math.log(sigma ** 2)
    phi2 = phi ** 2
    d2 = delta ** 2

    def f(x):
        ex = math.exp(x)
        num = ex * (d2 - phi2 - v - ex)
        den = 2 * (phi2 + v + ex) ** 2
        return num / den - (x - a) / TAU ** 2

    A = a
    if d2 > phi2 + v:
        B = math.log(d2 - phi2 - v)
    else:
        k = 1
        while f(a - k * TAU) < 0:
            k += 1
        B = a - k * TAU

    fA = f(A)
    fB = f(B)

    iterations = 0
    while abs(B - A) > EPSILON and iterations < 100:
        C = A + (A - B) * fA / (fB - fA)
        fC = f(C)
        if fC * fB <= 0:
            A = B
            fA = fB
        else:
            fA = fA / 2
        B = C
        fB = fC
        iterations += 1

    return math.exp(A / 2)


def update_rating(rating, rd, volatility, opponents):
    """
    Update a player's Glicko-2 rating.

    Args:
        rating: Current Glicko-1 rating (e.g., 1500)
        rd: Current rating deviation (e.g., 350)
        volatility: Current volatility (e.g., 0.06)
        opponents: List of (opponent_rating, opponent_rd, score)
                   score: 1.0 = win, 0.5 = draw, 0.0 = loss

    Returns:
        (new_rating, new_rd, new_volatility) in Glicko-1 scale
    """
    if not opponents:
        # No games: only RD increases
        phi = rd_to_glicko2(rd)
        new_phi = math.sqrt(phi ** 2 + volatility ** 2)
        return rating, min(glicko2_to_rd(new_phi), 350), volatility

    # Step 1: Convert to Glicko-2 scale
    mu = rating_to_glicko2(rating)
    phi = rd_to_glicko2(rd)

    glicko2_opponents = [
        (rating_to_glicko2(r), rd_to_glicko2(d), s)
        for r, d, s in opponents
    ]

    # Step 2: Compute variance
    v = compute_variance(mu, glicko2_opponents)

    # Step 3: Compute estimated improvement
    delta = compute_delta(mu, glicko2_opponents, v)

    # Step 4: Determine new volatility
    new_sigma = compute_new_volatility(volatility, phi, v, delta)

    # Step 5: Update rating deviation
    phi_star = math.sqrt(phi ** 2 + new_sigma ** 2)

    # Step 6: Update rating deviation and rating
    new_phi = 1 / math.sqrt(1 / phi_star ** 2 + 1 / v)
    new_mu = mu + new_phi ** 2 * sum(
        g(opp_phi) * (score - E(mu, opp_mu, opp_phi))
        for opp_mu, opp_phi, score in glicko2_opponents
    )

    # Step 7: Convert back
    new_rating = glicko2_to_rating(new_mu)
    new_rd = glicko2_to_rd(new_phi)

    # Clamp values
    new_rating = max(100, min(3500, round(new_rating)))
    new_rd = max(30, min(350, round(new_rd)))

    return new_rating, new_rd, round(new_sigma, 6)


def calculate_compatibility(player_rating, player_rd, match_min_skill, match_max_skill):
    """
    Calculate a 0-100 compatibility score between a player and a match.
    Higher = better fit.
    """
    mid = (match_min_skill + match_max_skill) / 2
    range_size = max(match_max_skill - match_min_skill, 1)

    # Distance from range center, normalized
    distance = abs(player_rating - mid)

    # Check if player is within the range
    if match_min_skill <= player_rating <= match_max_skill:
        # Within range: score based on how close to center
        score = 100 - (distance / (range_size / 2)) * 20
    else:
        # Outside range: penalty based on distance from nearest bound
        if player_rating < match_min_skill:
            out_distance = match_min_skill - player_rating
        else:
            out_distance = player_rating - match_max_skill
        score = max(0, 80 - out_distance / 10)

    # Factor in uncertainty (high RD = less certain = slight penalty)
    rd_penalty = max(0, (player_rd - 100) / 350) * 10
    score = max(0, min(100, score - rd_penalty))

    return round(score)


def suggest_balanced_teams(players):
    """
    Given a list of players with ratings, suggest balanced teams.

    Args:
        players: List of dicts with 'id', 'name', 'skill_rating'

    Returns:
        (team_a, team_b, rating_diff)
    """
    if len(players) < 2:
        return players, [], 0

    sorted_players = sorted(players, key=lambda p: p.get('skill_rating', 1500), reverse=True)
    team_a = []
    team_b = []
    sum_a = 0
    sum_b = 0

    # Serpentine draft for balance
    for i, player in enumerate(sorted_players):
        rating = player.get('skill_rating', 1500)
        if i % 4 < 2:
            # Alternate assignment pattern: 0,1 -> A,B then 2,3 -> B,A
            if i % 2 == 0:
                if sum_a <= sum_b:
                    team_a.append(player)
                    sum_a += rating
                else:
                    team_b.append(player)
                    sum_b += rating
            else:
                if sum_b <= sum_a:
                    team_b.append(player)
                    sum_b += rating
                else:
                    team_a.append(player)
                    sum_a += rating
        else:
            if sum_a <= sum_b:
                team_a.append(player)
                sum_a += rating
            else:
                team_b.append(player)
                sum_b += rating

    avg_a = sum_a / max(len(team_a), 1)
    avg_b = sum_b / max(len(team_b), 1)

    return team_a, team_b, round(abs(avg_a - avg_b))
