from __future__ import annotations

import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

# All limiters created via rate_limit(); lets tests reset shared state.
_REGISTRY: list[SlidingWindowRateLimiter] = []

_PRUNE_INTERVAL_SECONDS = 60.0


class SlidingWindowRateLimiter:
    """In-process sliding-window rate limiter.

    Counters live in process memory, which matches the single-process uvicorn
    deployment this app uses; they reset on restart and are not shared across
    workers.
    """

    def __init__(self, limit: int, window_seconds: float) -> None:
        if limit < 1:
            raise ValueError("limit must be at least 1")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_prune = time.monotonic()

    def hit(self, key: str) -> float | None:
        """Record a hit for ``key``.

        Returns ``None`` when the request is allowed, or the number of
        seconds until the oldest hit leaves the window when the limit is
        exceeded (the request is not recorded in that case).
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = hits[0] - cutoff
                self._prune_locked(now)
                return retry_after
            hits.append(now)
            self._prune_locked(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def _prune_locked(self, now: float) -> None:
        """Drop idle keys so the hit map cannot grow without bound."""
        if now - self._last_prune < _PRUNE_INTERVAL_SECONDS:
            return
        self._last_prune = now
        cutoff = now - self.window_seconds
        stale_keys = [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]
        for key in stale_keys:
            del self._hits[key]


def reset_rate_limiters() -> None:
    """Reset every limiter created via rate_limit(). Intended for tests."""
    for limiter in _REGISTRY:
        limiter.reset()


def rate_limit(
    scope: str,
    *,
    limit: int,
    window_seconds: float,
) -> Callable[[Request], None]:
    """Build a FastAPI dependency limiting requests per client IP."""
    limiter = SlidingWindowRateLimiter(limit=limit, window_seconds=window_seconds)
    _REGISTRY.append(limiter)

    def dependency(request: Request) -> None:
        client_host = request.client.host if request.client else "unknown"
        retry_after = limiter.hit(f"{scope}:{client_host}")
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(max(1, math.ceil(retry_after)))},
            )

    return dependency
