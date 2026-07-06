# QFlow — ER Diagram

This document contains the Entity-Relationship (ER) diagram for the QFlow Database. It defines the schemas, columns, types, and relationships.

## Mermaid ER Diagram

```mermaid
erDiagram
    roles ||--o{ users : "has"
    offices ||--o{ counters : "contains"
    offices ||--o{ services : "offers"
    offices ||--o{ holidays : "observes"
    users ||--o{ appointments : "books"
    offices ||--o{ appointments : "hosts"
    services ||--o{ appointments : "for"
    counters ||--o{ appointments : "assigned_to"
    appointments ||--o{ queue_entries : "has"
    offices ||--o{ queue_entries : "manages"
    counters ||--o{ queue_entries : "serves_at"
    users ||--o{ notifications : "receives"
    appointments ||--o{ notifications : "triggers"
    users ||--o{ audit_logs : "performed_by"
    users ||--o{ refresh_tokens : "owns"

    roles {
        integer id PK
        string name "citizen, staff, admin"
    }

    users {
        integer id PK
        string full_name
        string email UK
        string phone
        string password_hash
        integer role_id FK
        string language_pref "en, es, etc."
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    refresh_tokens {
        integer id PK
        integer user_id FK
        string token_hash UK
        datetime issued_at
        datetime expires_at
        datetime revoked_at "nullable"
        string device_info "nullable"
        datetime created_at
    }

    offices {
        integer id PK
        string name
        string address
        string city
        float latitude
        float longitude
        json working_hours "JSON representing open/close times"
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    counters {
        integer id PK
        integer office_id FK
        string name "e.g., Counter 1, Window A"
        integer assigned_staff_id FK "References users.id"
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    services {
        integer id PK
        integer office_id FK
        string name "e.g., License Renewal, Passport Application"
        integer avg_duration_minutes
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    appointments {
        integer id PK
        integer user_id FK "References users.id"
        integer office_id FK
        integer service_id FK
        integer counter_id FK "References counters.id, nullable"
        datetime scheduled_time
        string status "pending, confirmed, checked_in, in_progress, completed, cancelled, no_show"
        string qr_code_token UK
        datetime created_at
        datetime updated_at
    }

    queue_entries {
        integer id PK
        integer appointment_id FK "References appointments.id"
        integer office_id FK
        integer counter_id FK "References counters.id, nullable (assigned when called)"
        integer position "sequential line number"
        string status "waiting, called, processing, completed, skipped"
        integer estimated_wait_minutes
        datetime called_at "nullable"
        datetime created_at
        datetime updated_at
    }

    notifications {
        integer id PK
        integer user_id FK "References users.id"
        integer appointment_id FK "References appointments.id, nullable"
        string type "email, sms, whatsapp"
        string status "pending, sent, failed"
        string recipient_address "email address or phone number"
        text message_body
        datetime sent_at "nullable"
        datetime created_at
    }

    audit_logs {
        integer id PK
        integer user_id FK "References users.id, nullable"
        string action "e.g., login, create_appointment, call_ticket"
        string entity_type "e.g., users, appointments, offices"
        integer entity_id "nullable"
        json metadata "nullable additional details"
        datetime created_at
    }

    holidays {
        integer id PK
        integer office_id FK "References offices.id, nullable (global if null)"
        date date
        string description
        datetime created_at
    }
```

## Propose Schema Enhancements (Beyond Locked Baseline)

The following changes are added to support practical implementation:
1. **`users.updated_at` / `offices.updated_at` / `counters.updated_at` / `services.updated_at` / `appointments.updated_at` / `queue_entries.updated_at`**: Added standard modification tracking for data integrity and cache invalidation.
2. **`refresh_tokens` Table**: Required for secure, stateless JWT authentication with token rotation.
3. **`queue_entries.counter_id`**: Added to track which counter called the ticket, resolving where the customer should report.
4. **`queue_entries.status`**: Explicitly enumerated values (`waiting`, `called`, `processing`, `completed`, `skipped`).
5. **`notifications.recipient_address` & `message_body`**: Included to capture the actual contact point and body content at queuing time.
6. **`holidays.office_id` (Nullable)**: Allows defining a "global holiday" (applies to all offices if `office_id` is null) or "office-specific holiday" (applies to a single office).
