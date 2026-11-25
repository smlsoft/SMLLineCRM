## claude-code · task 031 · CLAIMED

- **did:** claimed task 031 - The login exemption in the admin proxy matches only the exact paths `auth/login`, `auth/logout` and `auth/me`, so a path such as `auth/..%2fconversations` needs a valid login like every other path.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/api/proxy/[...path]/route.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/031-proxy-exact-auth-paths.md

## claude-code · task 031 · DONE

- **did:** the proxy's login exemption is the exact set `auth/login`, `auth/logout`, `auth/me` (`line-kpi-admin/src/app/api/proxy/[...path]/route.ts:22`) instead of the prefix `auth/`.
- **files touched:** line-kpi-admin/src/app/api/proxy/[...path]/route.ts
- **decided:** none
- **not checked:** production; `GET auth/me` still gets no `Authorization` header from the proxy (unchanged, no caller found).
- **next:** none
