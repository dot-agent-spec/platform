# Changesets

Every pull request that changes a published package carries a file here declaring what changed, for whom.
[Changesets](https://github.com/changesets/changesets) reads these files — never commit messages — and
`npx changeset version` turns them into the version bump, the re-pinned exact dependencies and each
package's `CHANGELOG.md`. CI (`.github/workflows/changeset-status.yml`) fails a pull request that touches a
package without one.

```sh
npx changeset            # pick the packages, the bump, write the summary
npx changeset add --empty # the change needs no release: docs inside a package, tests, a dependency bump
```

What is particular to this repository:

- **The bump follows the 0.x rule in the `/publish` skill.** `patch` is a fix with no contract or WASM-ABI
  change; `minor` is anything additive or breaking. `major` is reserved for 1.0 and is never used in 0.x.
- **The seven npm packages are one `fixed` group.** A release moves all of them to the same version, so
  naming only the package you changed is enough — the others follow, and the changelog of one that did
  not change gets an empty version heading.
- **`vscode-dot-agent` is ignored.** It bundles the build output and ships on its own track, so no
  changeset may name it, and its `CHANGELOG.md` stays hand-written in Keep a Changelog format.
- **The summary is the changelog entry**, read by someone upgrading. Write what changed for them and what
  they must do, not what the diff did. Stage the file before running `npx changeset status` locally: the
  command resolves through git, and an untracked changeset reads as none.
