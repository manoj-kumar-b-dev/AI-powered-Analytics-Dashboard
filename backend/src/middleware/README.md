# Middleware Layer

- **Purpose**: Enforce cross-cutting concerns on incoming HTTP requests.
- **Belongs here**: Authentication guards, authorization checks, tenant context injectors, global error handlers, upload helpers (e.g. Multer configs), and logging.
- **Does NOT belong here**: Core business logic, direct database calls, HTML rendering, and request validation schemas.
