"""
Role-based permission definitions.

Roles:
  admin    — full access
  operator — register + recognize + view log, no user management, no delete
  viewer   — recognize + view log only (read-only)
"""

from typing import Literal

Role = Literal["admin", "operator", "viewer"]

PERMISSIONS: dict[str, set[Role]] = {
    # Face endpoints
    "face:detect":            {"admin", "operator", "viewer"},
    "face:recognize":         {"admin", "operator", "viewer"},
    "face:view_log":          {"admin", "operator", "viewer"},
    "face:view_employees":    {"admin", "operator", "viewer"},
    "face:register_employee": {"admin", "operator"},
    "face:delete_employee":   {"admin"},

    # Auth / user management
    "auth:view_users":        {"admin"},
    "auth:create_user":       {"admin"},
    "auth:delete_user":       {"admin"},
}


def has_permission(role: str, permission: str) -> bool:
    allowed_roles = PERMISSIONS.get(permission, set())
    return role in allowed_roles
