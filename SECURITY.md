# Security policy

## Reporting a vulnerability

Report a vulnerability privately, through GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/dot-agent-spec/platform/security/advisories/new)**
([how it works](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

Do not open a public issue, pull request or discussion for a vulnerability. A public report gives an
attacker the flaw before users have a fix.

A useful report contains:

- the package and version affected;
- the input that triggers the flaw — for example a `.behavior` or `.description` file — and the command or API call that reads it;
- what happens, against what should happen;
- whether you believe it is already being exploited.

## Supported versions

The project is pre-1.0. Security fixes land in the **latest published version** of each package and
are released as a new patch or minor version. Earlier versions receive no fixes.

| Package | Registry | Supported |
|---|---|---|
| `@dot-agent/tree-sitter`, `dot-agent-tree-sitter` | npm, crates.io | latest release |
| `@dot-agent/parser-dsl`, `dot-agent-parser-dsl` | npm, crates.io | latest release |
| `@dot-agent/compiler` | npm | latest release |
| `@dot-agent/kernel-dsl`, `dot-agent-kernel-dsl` | npm, crates.io | latest release |
| `@dot-agent/language-server` | npm | latest release |
| `@dot-agent/cli` | npm | latest release |
| `@dot-agent/sdk` | npm | latest release |
| `dot-agent.vscode-dot-agent` (VS Code extension) | Visual Studio Marketplace | latest release |

## In scope

Any way that input written by someone other than the user makes a package crash, hang, consume
unbounded time or memory, run code, read or write outside the agent's own directory, leak data, or
show a program different from the one that runs. The inputs in question are agent files, identifiers,
configuration and packaged agents. The last point includes display spoofing in the editor or the agent
graph.

Out of scope:

- vulnerabilities in a third-party dependency — report those to the dependency, and tell us if a fix
  here is needed;
- behaviour that requires the user to write a malicious configuration for their own machine;
- the output a language model produces from a prompt the agent passes to it faithfully.

## What happens after you report

| Step | Target |
|---|---|
| Acknowledgement | within 7 days |
| First assessment: confirmed or not, and severity | within 14 days |
| Fix released | as soon as possible, and within 90 days of the report |

The maintainer works on the fix in the advisory's temporary private fork, which stays invisible until
publication. The order of events is:

1. The fix is merged, and a release goes to npm, crates.io and the Marketplace.
2. The security advisory is published, with a CVE requested through GitHub and credit to the reporter.
3. Regression tests and reproducers for the flaw land in the public repository.

**Disclosure deadline.** The advisory is published when the fix is released, or 90 days after the
report, whichever comes first. If a fix is scheduled for release within 14 days after the deadline,
publication waits for it. With no fix by the deadline, the advisory is published with the known
mitigations. Active exploitation can bring any date forward.

## Findings from the project's own reviews

Vulnerabilities found by the project's own security reviews and fuzzing follow the same process. They
are filed as draft advisories rather than public issues. Material that points at an unfixed flaw
stays private until its advisory is published:

- the exact reproducer;
- the regression case;
- review tooling written for that flaw.

## Safe harbour

We will not pursue legal action against good-faith research that follows this policy. That research:

- tests only against your own installation or data;
- avoids harm to others' data and services;
- gives us the chance to fix the flaw before any disclosure.

If you are unsure whether something is in scope, report it and ask.

## Credit

Reporters are credited in the published advisory, under the name they choose, unless they ask to stay
anonymous.
