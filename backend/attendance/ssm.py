import json
import queue
import threading
from typing import Any

# Simple in-memory pub/sub for Server-Sent Events (SSE).
# This is intentionally minimal and works for single-process development.

_clients: set[queue.Queue] = set()
_clients_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _clients_lock:
        _clients.add(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _clients_lock:
        _clients.discard(q)


def publish_event(payload: Any) -> None:
    """Publish a JSON-serializable payload to all connected SSE clients."""
    text = None
    try:
        text = json.dumps(payload, default=str)
    except Exception:
        # Fallback - attempt coarse stringification
        text = str(payload)

    with _clients_lock:
        for q in list(_clients):
            try:
                # Put without blocking to avoid stalling publisher
                q.put_nowait(text)
            except Exception:
                # ignore client queue failures
                pass
