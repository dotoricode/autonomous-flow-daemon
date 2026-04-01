# Open Questions

## afd-v1.5-trust-builder - 2026-04-02
- [ ] Should `mistake_type` values be stored in Korean or English? — Affects HUD display consistency and potential i18n needs. Spec shows Korean in HUD (`타입 불일치`) but DB storage in English may be cleaner for querying.
- [ ] Retention policy for `mistake_history`: 90 days (matching telemetry) or indefinite? — Affects DB size over time for long-lived projects.
- [ ] Should Hologram L1 handle barrel files (index.ts re-exporting from multiple modules)? — If contextFile imports from a barrel, L1 needs to trace through to the actual source. This adds complexity. Could defer to v1.6.
- [ ] Should the HUD defense count reset on daemon restart or persist across sessions? — Current `autoHealCount` is in-memory (resets). With `mistake_history` in SQLite, we could show lifetime count instead.
- [ ] Path normalization strategy for `mistake_history.file_path`: store as-received or normalize to forward slashes? — Windows paths use backslashes but existing code has mixed handling (see `http-routes.ts` line 203 `.replace(/\//g, "\\")`).
