import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.db.repository import get_events

print("--- TESTING BACKEND SEARCH & BEHAVIOUR LIKE WILDCARD HANDLING ---")

# 1. Normal behaviour search
events_dropped = get_events(behaviour="Dropped")
print(f"1. Behaviour 'Dropped': {len(events_dropped)} events found")
assert len(events_dropped) > 0, "Should find dropped events"

# 2. Wildcard literal search: '_' should not match any arbitrary character if escaped
# If unescaped, 'Dr_pped' would match 'Dropped'. With escaping, 'Dr_pped' should only match literal 'Dr_pped'
events_wildcard = get_events(behaviour="Dr_pped")
print(f"2. Behaviour with literal underscore 'Dr_pped': {len(events_wildcard)} events found (expected 0)")
assert len(events_wildcard) == 0, "Underscore should be treated literally and NOT match 'Dropped'"

# 3. Percent wildcard literal search: '%' should not match everything if escaped
events_percent = get_events(behaviour="Product%Dropped")
print(f"3. Behaviour with literal percent 'Product%Dropped': {len(events_percent)} events found (expected 0)")
assert len(events_percent) == 0, "Percent should be treated literally and NOT match 'Product Dropped'"

# 4. Search parameter
events_search = get_events(search="carton")
print(f"4. Search 'carton': {len(events_search)} events found")
assert len(events_search) > 0, "Search 'carton' should return matches"

# 5. Search with literal special characters
events_search_wildcard = get_events(search="heavy_carton")
print(f"5. Search with literal underscore 'heavy_carton': {len(events_search_wildcard)} events found (expected 0)")
assert len(events_search_wildcard) == 0, "Search underscore should be escaped"

print("\nALL BACKEND SEARCH & LIKE TESTS PASSED SUCCESSFULLY!")
