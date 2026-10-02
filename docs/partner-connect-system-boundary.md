# Partner Connect system boundary

Partner Connect is a company-system integration application.

- Do not add personal Work Hub, BokDesk, personal task, personal game, or private productivity routes to this application.
- Personal Work Hub must use an independent application and deployment boundary.
- Partner Connect authentication, navigation, APIs, static assets, and deployment output must not depend on Work Hub.
- Historical database migrations may remain for migration-history integrity, but they are not runtime features of Partner Connect.
