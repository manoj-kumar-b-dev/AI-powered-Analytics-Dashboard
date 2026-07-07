# Controllers Layer

- **Purpose**: Thin HTTP handlers that parse requests and return responses.
- **Belongs here**: Extracting parameters, calling services, and mapping results to HTTP responses.
- **Does NOT belong here**: Business logic, direct MongoDB database access (repositories only), and external API integration.
