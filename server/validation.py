PRIORITIES = ("Low", "Medium", "High")
TITLE_MAX = 200
DESCRIPTION_MAX = 2000


def validate_create(body: dict):
    errors = []
    title = _title(body.get("title"), errors, required=True)
    description = _description(body.get("description"), errors)
    priority = _priority(body.get("priority"), errors, default="Medium")
    column_id = _id(body.get("columnId", body.get("column_id")), "columnId", errors, required=True)
    return errors, {
        "title": title,
        "description": description,
        "priority": priority,
        "column_id": column_id,
    }


def validate_update(body: dict):
    errors = []
    value = {}

    if "title" in body:
        value["title"] = _title(body.get("title"), errors, required=True)
    if "description" in body:
        value["description"] = _description(body.get("description"), errors)
    if "priority" in body:
        value["priority"] = _priority(body.get("priority"), errors, default=None)
    if "columnId" in body or "column_id" in body:
        value["column_id"] = _id(body.get("columnId", body.get("column_id")), "columnId", errors, required=True)

    if not any(key in body for key in ("title", "description", "priority", "columnId", "column_id")):
        errors.append("Provide at least one of title, description, priority, or columnId")

    return errors, value


def validate_move(body: dict):
    errors = []
    column_id = _id(body.get("columnId", body.get("column_id")), "columnId", errors, required=True)
    return errors, {"column_id": column_id}


def parse_optional_priority(raw):
    if raw in (None, "", "all"):
        return None, None
    if raw not in PRIORITIES:
        return None, "priority must be Low, Medium, or High"
    return raw, None


def _title(raw, errors, *, required):
    if raw is None:
        if required:
            errors.append("Title is required")
        return ""
    if not isinstance(raw, str):
        errors.append("Title must be a string")
        return ""
    title = raw.strip()
    if not title:
        errors.append("Title is required")
        return ""
    if len(title) > TITLE_MAX:
        errors.append(f"Title must be {TITLE_MAX} characters or fewer")
    return title


def _description(raw, errors):
    if raw in (None, ""):
        return None
    if not isinstance(raw, str):
        errors.append("Description must be a string")
        return None
    description = raw.strip()
    if len(description) > DESCRIPTION_MAX:
        errors.append(f"Description must be {DESCRIPTION_MAX} characters or fewer")
    return description or None


def _priority(raw, errors, *, default):
    if raw in (None, ""):
        if default is None:
            errors.append("Priority is required")
        return default
    if raw not in PRIORITIES:
        errors.append("Priority must be Low, Medium, or High")
        return default
    return raw


def _id(raw, field, errors, *, required):
    if raw in (None, ""):
        if required:
            errors.append(f"{field} is required")
        return None
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        errors.append(f"{field} must be a positive integer")
        return None
    if parsed < 1:
        errors.append(f"{field} must be a positive integer")
        return None
    return parsed
