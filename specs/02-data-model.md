# Data Model

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    User      │──1:N──│    Collection    │──1:N──│    Item      │
└──────────────┘       └──────────────────┘       └──────────────┘
       │                       │                         │
       │                       │                         │
       │               ┌───────┴───────┐                 │
       │               │               │                 │
       │         ┌─────┴─────┐   ┌─────┴─────┐     ┌─────┴─────┐
       │         │FieldDef   │   │MobileLink │     │ItemImage  │
       │         └───────────┘   └───────────┘     └───────────┘
       │                                                 
 ┌─────┴─────┐
 │EmailToken │
 └───────────┘
```

## Tables

### User
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User's email |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash |
| display_name | VARCHAR(100) | | Optional display name |
| is_verified | BOOLEAN | DEFAULT FALSE | Email verified |
| is_active | BOOLEAN | DEFAULT TRUE | Account active |
| created_at | TIMESTAMP | NOT NULL | Creation time |
| updated_at | TIMESTAMP | NOT NULL | Last update |

**Indexes**: `email` (unique)

### EmailToken
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK(User), NOT NULL | Owner |
| token | VARCHAR(64) | UNIQUE, NOT NULL | Verification token |
| token_type | VARCHAR(20) | NOT NULL | "verify" or "reset" |
| expires_at | TIMESTAMP | NOT NULL | Expiration time |
| used_at | TIMESTAMP | | When token was used |
| created_at | TIMESTAMP | NOT NULL | Creation time |

**Indexes**: `token` (unique), `user_id`

### Collection
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK(User), NOT NULL | Owner |
| name | VARCHAR(200) | NOT NULL | Collection name |
| description | TEXT | | Optional description |
| created_at | TIMESTAMP | NOT NULL | Creation time |
| updated_at | TIMESTAMP | NOT NULL | Last update |

**Indexes**: `user_id`, `(user_id, name)` (unique)

### FieldDefinition
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| collection_id | UUID | FK(Collection), NOT NULL | Parent collection |
| name | VARCHAR(100) | NOT NULL | Field name |
| field_type | VARCHAR(20) | NOT NULL | See field types below |
| is_required | BOOLEAN | DEFAULT FALSE | Mandatory field |
| display_order | INTEGER | DEFAULT 0 | UI ordering |
| options | JSON | | For select/multi-select |
| default_value | TEXT | | Default value |
| created_at | TIMESTAMP | NOT NULL | Creation time |

**Field Types**: `text`, `number`, `date`, `timestamp`, `checkbox`, `select`, `multiselect`, `textarea`

**Indexes**: `collection_id`, `(collection_id, name)` (unique)

### Item
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| collection_id | UUID | FK(Collection), NOT NULL | Parent collection |
| name | VARCHAR(200) | NOT NULL | Item name/title |
| metadata | JSON | NOT NULL, DEFAULT {} | Dynamic field values |
| notes | TEXT | | Free-form notes |
| created_at | TIMESTAMP | NOT NULL | Creation time |
| updated_at | TIMESTAMP | NOT NULL | Last update |

**Metadata JSON Structure**:
```json
{
  "field_name_1": "value",
  "field_name_2": 123,
  "field_name_3": true,
  "field_name_4": ["option1", "option2"]
}
```

**Indexes**: `collection_id`, `created_at`, `(collection_id, name)`

### ItemImage
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| item_id | UUID | FK(Item), NOT NULL | Parent item |
| filename | VARCHAR(255) | NOT NULL | Stored filename |
| original_filename | VARCHAR(255) | | Original upload name |
| file_path | VARCHAR(500) | NOT NULL | Relative path |
| file_size | INTEGER | NOT NULL | Size in bytes |
| mime_type | VARCHAR(50) | NOT NULL | image/jpeg, etc. |
| width | INTEGER | | Image width |
| height | INTEGER | | Image height |
| checksum | VARCHAR(64) | NOT NULL | SHA-256 for verification |
| display_order | INTEGER | DEFAULT 0 | Ordering |
| is_primary | BOOLEAN | DEFAULT FALSE | Main image |
| created_at | TIMESTAMP | NOT NULL | Upload time |

**Indexes**: `item_id`, `checksum`

### MobileLink
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK(User), NOT NULL | Owner |
| collection_id | UUID | FK(Collection) | Linked collection |
| pairing_code | VARCHAR(8) | UNIQUE | 8-char code for pairing |
| device_name | VARCHAR(100) | | Friendly device name |
| device_id | VARCHAR(100) | | Android device ID |
| access_token | VARCHAR(255) | | JWT for mobile |
| is_active | BOOLEAN | DEFAULT TRUE | Link active |
| paired_at | TIMESTAMP | | When paired |
| last_used_at | TIMESTAMP | | Last activity |
| expires_at | TIMESTAMP | NOT NULL | Expiration |
| created_at | TIMESTAMP | NOT NULL | Creation time |

**Indexes**: `user_id`, `pairing_code` (unique), `access_token`

## File Storage Structure

```
uploads/
├── {user_uuid}/
│   ├── {collection_uuid}/
│   │   ├── {item_uuid}/
│   │   │   ├── {uuid}_original.jpg
│   │   │   ├── {uuid}_thumb.jpg     # 200x200
│   │   │   └── {uuid}_medium.jpg    # 800x800
│   │   └── ...
│   └── ...
└── ...
```

## Migrations Strategy

Use Alembic for database migrations:
- Auto-generate migrations from model changes
- Version control all migrations
- Support for rollback
