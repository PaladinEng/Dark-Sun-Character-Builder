Run the 13-stage validation harness. Parse the output and report which stages passed/failed. If any stage fails, read the failure output, diagnose the root cause, and fix it. Re-run until all 13 stages pass.

```bash
pnpm loop:check
```
