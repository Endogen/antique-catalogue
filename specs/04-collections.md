# Collections

## Overview

Collections are user-created containers for items. Each collection has a custom metadata schema that defines what fields items in that collection have.

## Collection Management

### Create Collection

```
POST /collections
{
  "name": "Victorian Furniture",
  "description": "Furniture from the Victorian era (1837-1901)"
}

Response:
{
  "id": "uuid",
  "name": "Victorian Furniture",
  "description": "Furniture from the Victorian era (1837-1901)",
  "item_count": 0,
  "field_definitions": [],
  "created_at": "2026-02-07T10:00:00Z",
  "updated_at": "2026-02-07T10:00:00Z"
}
```

### List Collections

```
GET /collections
GET /collections?search=victorian

Response:
{
  "items": [...],
  "total": 5,
  "page": 1,
  "per_page": 20
}
```

### Get Collection

```
GET /collections/{id}

Response: Full collection with field_definitions and item_count
```

### Update Collection

```
PATCH /collections/{id}
{
  "name": "New Name",
  "description": "New description"
}
```

### Delete Collection

```
DELETE /collections/{id}

- Requires confirmation (pass ?confirm=true or body.confirm)
- Deletes all items and images in collection
- Cascading delete
```

## Field Definitions (Metadata Schema)

### Field Types

| Type | Description | Options | Example Value |
|------|-------------|---------|---------------|
| `text` | Single line text | max_length | "Oak wood" |
| `textarea` | Multi-line text | max_length | "Long description..." |
| `number` | Numeric value | min, max, decimals | 1850, 99.99 |
| `date` | Date only | min_date, max_date | "1850-01-15" |
| `timestamp` | Date and time | | "2026-02-07T10:00:00Z" |
| `checkbox` | Boolean | | true/false |
| `select` | Single choice | options[] | "Excellent" |
| `multiselect` | Multiple choices | options[] | ["tag1", "tag2"] |

### Add Field Definition

```
POST /collections/{id}/fields
{
  "name": "Estimated Age",
  "field_type": "number",
  "is_required": true,
  "display_order": 1,
  "options": {
    "min": 0,
    "max": 2000,
    "decimals": 0
  },
  "default_value": null
}

Response:
{
  "id": "uuid",
  "name": "Estimated Age",
  "field_type": "number",
  "is_required": true,
  "display_order": 1,
  "options": {"min": 0, "max": 2000, "decimals": 0},
  "default_value": null,
  "created_at": "..."
}
```

### Select/Multiselect Options

```
POST /collections/{id}/fields
{
  "name": "Condition",
  "field_type": "select",
  "is_required": true,
  "options": {
    "choices": [
      {"value": "excellent", "label": "Excellent"},
      {"value": "good", "label": "Good"},
      {"value": "fair", "label": "Fair"},
      {"value": "poor", "label": "Poor"},
      {"value": "restoration_needed", "label": "Needs Restoration"}
    ]
  }
}
```

### Update Field Definition

```
PATCH /collections/{id}/fields/{field_id}
{
  "name": "New Name",
  "is_required": false,
  "display_order": 5
}
```

**Restrictions**:
- Cannot change field_type if items already use this field
- Changing options for select/multiselect: existing values remain valid

### Delete Field Definition

```
DELETE /collections/{id}/fields/{field_id}

- Removes field from schema
- Does NOT remove existing values from items (they become orphaned but preserved)
```

### Reorder Fields

```
PUT /collections/{id}/fields/order
{
  "order": ["field_id_1", "field_id_2", "field_id_3"]
}
```

## Example: Antique Furniture Collection

### Schema Definition

```json
{
  "name": "Antique Furniture",
  "description": "Furniture collection",
  "field_definitions": [
    {
      "name": "Purchase Date",
      "field_type": "date",
      "is_required": false,
      "display_order": 1
    },
    {
      "name": "Purchase Price",
      "field_type": "number",
      "is_required": false,
      "display_order": 2,
      "options": {"min": 0, "decimals": 2}
    },
    {
      "name": "Purchase Location",
      "field_type": "text",
      "is_required": false,
      "display_order": 3
    },
    {
      "name": "Estimated Age (years)",
      "field_type": "number",
      "is_required": false,
      "display_order": 4,
      "options": {"min": 0, "max": 2000}
    },
    {
      "name": "Dimensions",
      "field_type": "text",
      "is_required": false,
      "display_order": 5,
      "options": {"placeholder": "H x W x D in cm"}
    },
    {
      "name": "Weight (kg)",
      "field_type": "number",
      "is_required": false,
      "display_order": 6,
      "options": {"min": 0, "decimals": 1}
    },
    {
      "name": "Condition",
      "field_type": "select",
      "is_required": true,
      "display_order": 7,
      "options": {
        "choices": [
          {"value": "excellent", "label": "Excellent"},
          {"value": "good", "label": "Good"},
          {"value": "fair", "label": "Fair"},
          {"value": "poor", "label": "Poor"}
        ]
      }
    },
    {
      "name": "Materials",
      "field_type": "multiselect",
      "is_required": false,
      "display_order": 8,
      "options": {
        "choices": [
          {"value": "oak", "label": "Oak"},
          {"value": "mahogany", "label": "Mahogany"},
          {"value": "walnut", "label": "Walnut"},
          {"value": "brass", "label": "Brass"},
          {"value": "leather", "label": "Leather"},
          {"value": "marble", "label": "Marble"}
        ]
      }
    },
    {
      "name": "Authenticated",
      "field_type": "checkbox",
      "is_required": false,
      "display_order": 9,
      "default_value": false
    }
  ]
}
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /collections | List user's collections |
| POST | /collections | Create collection |
| GET | /collections/{id} | Get collection details |
| PATCH | /collections/{id} | Update collection |
| DELETE | /collections/{id} | Delete collection |
| POST | /collections/{id}/fields | Add field definition |
| PATCH | /collections/{id}/fields/{fid} | Update field |
| DELETE | /collections/{id}/fields/{fid} | Delete field |
| PUT | /collections/{id}/fields/order | Reorder fields |
