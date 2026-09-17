# Disposable PostgreSQL fault tests

These integration tests exercise production PostgreSQL provisioning, ownership, health,
diagnostics and workflow durability for #3072/#3074. They require the repository's
normal npm install/build and Bun fixture runtime. Missing prerequisites fail the tests;
there are no platform skips or environment opt-in gates.

```sh
npm ci --ignore-scripts
npm run build
npm run test:integration -- test/integration/postgres-real-isolation.test.ts test/integration/postgres-real-dependency-failure.test.ts test/integration/workflow-postgres-real-outage.test.ts test/integration/postgres-managed-dbos-recovery.test.ts
```

Run as an unprivileged account. The fixtures reject UID 0 because production root
provisioning uses `/var/lib/atomic-postgres`, which is not a disposable test directory.
Each test allocates its own temporary home/data directory and loopback ports. No test
stops a process by a port number or operates on a configured user database. PostgreSQL
shutdown uses `pg_ctl -D` against only the fixture's directory. A failed cleanup retains
the directory rather than deleting live data. Runtime damage is confined to copied
executables whose dependent libraries are deliberately omitted.

| Scenario | Evidence |
| --- | --- |
| Owner exits with another live consumer | Original server identity and persisted SQL row survive; live consumer leases are inspectable |
| Database lost with concurrent recovery/reconnect | Independent client processes converge on one server, same cluster ID, directory identity, database system identifier and persisted selected port; SQL row survives |
| Managed DBOS pools recover in two live consumers | Production health polling restarts the owned server before resume; existing backends reconnect, retain same-ID checkpoints and hydrate each other's persisted completion without repeating completed author work |
| Non-PostgreSQL listener occupies preferred port | Managed cluster selects another port and sentinel listener still responds |
| Another project's PostgreSQL occupies preferred port | Two simultaneous managed clients converge on an alternate port; reconnect retains it; other server identity and sentinel row are unchanged |
| Missing runtime libraries | Real copied executables fail preflight; doctor reports unavailable; no data initialization |
| Explicit external endpoint fails | Doctor/recover remain external and bounded, with no managed cluster created |
| Database lost before admission | Actual rejected admission reaches `blocked_dependency`, with responsive public status and no author work; immediate startup controls remain covered; separate pause/quit cases wait for a real DBOS TCP connection before asserting bounded acknowledgement, same-ID pause recovery and no late author work after quit |
| Database lost after a completed checkpoint | Quit reports local pause and persistence failure; recovery resumes the same ID without repeating the completed author callback; a fresh backend reads persisted completion |

The outage fixture controls its own external PostgreSQL endpoint so managed automatic
recovery cannot erase the outage before the control assertion. Its connection-barrier
cases temporarily replace that owned endpoint with a listener that accepts the DBOS
connection but withholds the PostgreSQL handshake until control acknowledges.
The managed DBOS recovery test warms two independent processes' production pools,
stops only their owned server and observes automatic recovery before resuming through
the existing backends. A callback interrupted
before its result is durably checkpointed may run again; these tests do not claim
exactly-once arbitrary external side effects with unknown outcomes.

The shutdown fixture acknowledges disappearance of the captured postmaster identity,
not disappearance of every PID file in the directory: automatic recovery may already
have written the replacement's PID file. Managed recovery failures include elapsed
shutdown timing and the disposable server's log. A focused identity regression also
covers shutdown during the health probe, before the elected starter checks readiness.

The tests are discovered by the existing integration project on Linux and Windows.
They do not change the CI matrix, worker parallelism or default test budget. Named
per-test budgets cover real process startup, initdb, outage/recovery and cleanup.
A local Linux pass is not evidence of a Windows pass; Windows execution remains a CI
verification requirement.
