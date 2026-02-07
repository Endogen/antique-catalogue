# Metadata Schema

## Overview
Each collection has a custom schema defining fields for its items.

## Field Definition
- `id`: UUID
- `collection_id`: foreign key
- `name`: string (field label)
- `field_type`: enum (see below)
- `is_required`: boolean
- `options`: JSON (for select type)
- `position`: integer (ordering)

## Field Types
| Type | Description | Validation |
|------|-------------|------------|
| `text` | Free text | String |
| `number` | Numeric value | Integer or float |
| `date` | Date only | YYYY-MM-DD |
| `timestamp` | Date + time | ISO 8601 |
| `checkbox` | Boolean | true/false |
| `select` | Pick from list | Value in options array |

## Select Options
For `select` type, `options` contains allowed values:
```json
{
  "options": ["Excellent", "Good", "Fair", "Poor"]
}
```

## Endpoints
```
GET    /collections/{id}/fields           # List fields
POST   /collections/{id}/fields           # Add field
PATCH  /collections/{id}/fields/{fid}     # Update field
DELETE /collections/{id}/fields/{fid}     # Delete field
PATCH  /collections/{id}/fields/reorder   # Reorder fields
```

## Validation
- Field names must be unique within collection
- Validation enforced on both frontend and backend
- Changing field type may require data migration
