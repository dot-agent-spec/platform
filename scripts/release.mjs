import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

function run(cmd, cwd = process.cwd()) {
  console.log(`\x1b[36m> ${cmd}\x1b[0m`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

async function main() {
  console.log('\n🚀 \x1b[1mStarting Release & Freeze Flow (DA-Style)\x1b[0m\n');

  // --- PHASE 0: Housekeeping ---
  console.log('--- Phase 0: Governance & Housekeeping ---');
  const confirmDocs = await ask('1. Are docs, examples, and RFC/DA statuses updated? (Y/n): ');
  if (confirmDocs.toLowerCase() === 'n') process.exit(1);

  // --- PHASE 1: Pre-flight Tests ---
  console.log('\n--- Phase 1: Pre-flight Tests ---');
  console.log('Running tests across all packages to ensure stability...');
  try {
    // Adjust this to the global workspace test command
    run('npm run test'); 
  } catch (e) {
    console.error('\x1b[31m❌ Tests failed! Release aborted.\x1b[0m');
    process.exit(1);
  }

  // --- PHASE 2: Version Bumps ---
  console.log('\n--- Phase 2: Versioning ---');
  const pkgStr = await ask('Which packages do you want to update? (e.g., tree-sitter, parser-dsl): ');
  const packages = pkgStr.split(',').map(p => p.trim());
  const version = await ask('What is the new version? (e.g., 0.5.0): ');

  console.log('\nUpdating files...');
  for (const pkg of packages) {
    const pkgPath = path.join('packages', pkg);
    
    // Update package.json
    const packageJsonPath = path.join(pkgPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      pkgData.version = version;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkgData, null, 2) + '\n');
      console.log(`✅ ${packageJsonPath} updated to ${version}`);
    }

    // Update Cargo.toml
    const cargoTomlPath = path.join(pkgPath, 'Cargo.toml');
    if (fs.existsSync(cargoTomlPath)) {
      let cargoData = fs.readFileSync(cargoTomlPath, 'utf8');
      cargoData = cargoData.replace(/^version\s*=\s*".*?"/m, `version = "${version}"`);
      fs.writeFileSync(cargoTomlPath, cargoData);
      console.log(`✅ ${cargoTomlPath} updated to ${version}`);
    }
  }

  // --- PHASE 3: Build ---
  console.log('\n--- Phase 3: Release Build ---');
  const confirmBuild = await ask('Do you want to build the artifacts (WASM, bindings) now? (Y/n): ');
  if (confirmBuild.toLowerCase() !== 'n') {
    try {
      // Adjust according to your build scripts (e.g., cargo run-script release)
      run('npm run build');
    } catch (e) {
      console.error('\x1b[31m❌ Build failed! Aborting.\x1b[0m');
      process.exit(1);
    }
  }

  // --- PHASE 4: Publish ---
  console.log('\n--- Phase 4: Publish ---');
  const confirmPublish = await ask(`Do you want to publish the packages ${packages.join(', ')} now? (y/N): `);
  if (confirmPublish.toLowerCase() === 'y') {
    for (const pkg of packages) {
      console.log(`Publishing ${pkg}...`);
      run('npm publish --access public', path.join('packages', pkg));
    }
  }

  // --- PHASE 5: Freeze & Tag ---
  console.log('\n--- Phase 5: Git Tag, Freeze and Cleanup ---');
  
  // Clean up the Release Markdown Task
  const taskPath = await ask('What is the path of the Release Markdown task file to delete? (leave empty if none): ');
  if (taskPath && fs.existsSync(taskPath)) {
    run(`git rm ${taskPath}`);
    console.log(`🗑️  Task ${taskPath} removed.`);
  }

  console.log('\n[Reminder] Manually update the table in `docs/explanation/architecture/implementation-status.md` to "🧊 Frozen".');
  const confirmCommit = await ask('Do you want to commit and generate the Git Tag now? (Y/n): ');
  
  if (confirmCommit.toLowerCase() !== 'n') {
    run('git add packages/ docs/ project/tasks/ Cargo.lock package-lock.json');
    run(`git commit -m "chore(release): bump ${packages.join(', ')} to ${version}"`);
    
    for (const pkg of packages) {
      run(`git tag @dot-agent/${pkg}@${version}`);
    }
    console.log(`\n🎉 Release ${version} successfully completed and 'Frozen'! Remember to run git push --tags.`);
  }

  rl.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
