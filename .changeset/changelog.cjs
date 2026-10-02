// SPDX-License-Identifier: Apache-2.0

// The changelog format `changeset version` writes, set by `changelog` in
// config.json. It differs from @changesets/cli/changelog in two places:
//
// - An entry is the changeset's summary alone, without the commit hash that
//   prefixes it. A batch of changesets added in one commit all carry the same
//   hash, which tells a reader nothing.
// - A package that moves only because its dependencies did gets one line
//   naming them, instead of one "Updated dependencies [<hash>]" line per
//   changeset behind them.

async function getReleaseLine(changeset) {
  const [first, ...rest] = changeset.summary.split('\n').map((line) => line.trimEnd())
  const body = rest.map((line) => (line ? `  ${line}` : line)).join('\n')
  return `\n\n- ${first}${rest.length ? `\n${body}` : ''}`
}

async function getDependencyReleaseLine(_changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return ''
  const names = dependenciesUpdated.map((dep) => `\`${dep.name}@${dep.newVersion}\``)
  return `\n\n- Updated dependencies: ${names.join(', ')}`
}

const changelogFunctions = { getReleaseLine, getDependencyReleaseLine }
module.exports = changelogFunctions
module.exports.default = changelogFunctions
