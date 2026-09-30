#!/usr/bin/env python3
"""Exercise the actual restart scripts with isolated files and fake services."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parent


class RestartTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ('server.sh', 'build.sh', 'lib/build-fingerprint.mjs'):
            target = self.root / 'scripts' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SCRIPTS / name, target)
        for name in ('package.json', 'app/package.json', 'harness/package.json'):
            self.write(name, '{}\n')
        self.write('app/page.tsx', 'export default function Page() { return null }\n')
        self.write('pnpm-lock.yaml', 'lockfileVersion: 9\n')
        self.write('pnpm-workspace.yaml', 'packages: [app, harness]\n')
        self.write('config', 'APP_NAME=restart-test\nAPP_PASS=test-fixture-password\n')
        self.write('bin/pnpm', '''#!/usr/bin/env bash
set -eu
if [[ "$1" == --version ]]; then echo "${TEST_PNPM_VERSION:-12.4.1}"; exit; fi
if [[ "$1" == install ]]; then
  echo install >> "$TEST_CALLS"
  [[ "${TEST_FAIL_INSTALL:-}" != 1 ]] || exit 1
  mkdir -p node_modules/.pnpm harness/node_modules/@cognisphere-sh/cognisphere-harness app/node_modules/next
  cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml
  echo modules > node_modules/.modules.yaml
  echo '{}' > harness/node_modules/@cognisphere-sh/cognisphere-harness/package.json
  echo '{}' > app/node_modules/next/package.json
else
  echo build >> "$TEST_CALLS"
  [[ "${TEST_FAIL_BUILD:-}" != 1 ]] || exit 1
  sleep "${TEST_BUILD_DELAY:-0}"
  mkdir -p "$2/.next/server" "$2/.next/static"
  echo build-id > "$2/.next/BUILD_ID"
  echo '{}' > "$2/.next/required-server-files.json"
  echo generated > "$2/next-env.d.ts"
  echo generated > "$2/tsconfig.tsbuildinfo"
  if [[ "${TEST_CHANGE_SOURCE:-}" == 1 ]]; then echo changed >> "$2/page.tsx"; fi
fi
''')
        self.write('bin/systemctl', '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$TEST_CALLS"\n')
        # Exercise do_build's sudo forwarding even if the test runs as root.
        self.write('bin/sudo', '#!/usr/bin/env bash\nshift 2\nexec "$@"\n')
        for path in (self.root / 'bin').iterdir():
            path.chmod(0o755)
        self.env = {
            **os.environ,
            'PATH': f'{self.root}/bin:{os.environ["PATH"]}',
            'TEST_CALLS': str(self.root / 'calls'),
            'COGNISPHERE_NPM_TOKEN': 'fixture-token',
            'SUDO_USER': 'fixture-user',
        }

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def run_script(self, *args, success=True, **env):
        result = subprocess.run(
            ['bash', str(self.root / 'scripts/server.sh'), *args],
            env={**self.env, **env}, capture_output=True, text=True,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def calls(self):
        path = self.root / 'calls'
        return path.read_text().splitlines() if path.exists() else []

    def warm(self):
        self.run_script('restart')
        self.write('calls', '')

    def test_first_restart_installs_builds_then_restarts_both(self):
        self.run_script('restart')
        self.assertEqual(self.calls(), ['install', 'build', 'restart restart-test-harness.service restart-test-app.service'])

    def test_unchanged_restart_reuses_install_and_build(self):
        self.warm()
        result = self.run_script('restart')
        self.assertEqual(self.calls(), ['restart restart-test-harness.service restart-test-app.service'])
        self.assertIn('skipping install', result.stdout)
        self.assertIn('skipping build', result.stdout)

    def test_same_content_new_mtime_does_not_build(self):
        self.warm()
        os.utime(self.root / 'app/page.tsx', None)
        self.run_script('start', 'app')
        self.assertEqual(self.calls(), ['restart restart-test-app.service'])

    def test_source_or_public_asset_change_builds_only_app(self):
        for name in ('app/page.tsx', 'app/public/icon.svg'):
            with self.subTest(name=name):
                self.warm()
                self.write(name, '<svg/>\n')
                self.run_script('restart', 'app')
                self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_deleted_source_builds(self):
        self.warm()
        (self.root / 'app/page.tsx').unlink()
        self.run_script('restart', 'app')
        self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_shared_harness_source_change_builds_app(self):
        self.warm()
        self.write('harness/plugins/webchat/questions.ts', 'export type Question = string\n')
        self.run_script('restart', 'app')
        self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_secret_config_change_builds(self):
        self.warm()
        self.write('config', 'APP_NAME=restart-test\nAPP_PASS=changed-fixture-password\n')
        self.run_script('restart', 'app')
        self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_exported_build_env_change_builds(self):
        self.write('app/page.tsx', 'console.log(process.env.MY_BUILD_SETTING)\n')
        self.warm()
        self.run_script('restart', 'app', MY_BUILD_SETTING='changed')
        self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_dependency_changes_reinstall_and_build(self):
        for name in ('pnpm-lock.yaml', 'pnpm-workspace.yaml', 'harness/package.json', '.npmrc', 'patches/fix.patch', 'node_modules/.pnpm/lock.yaml'):
            with self.subTest(name=name):
                self.warm()
                self.write(name, f'{name} changed\n')
                self.run_script('restart')
                self.assertEqual(self.calls()[:2], ['install', 'build'])

    def test_pnpm_version_change_reinstalls_and_builds(self):
        self.warm()
        self.run_script('restart', TEST_PNPM_VERSION='12.5.0')
        self.assertEqual(self.calls()[:2], ['install', 'build'])

    def test_missing_dependency_reinstalls(self):
        self.warm()
        (self.root / 'app/node_modules/next/package.json').unlink()
        self.run_script('restart')
        self.assertEqual(self.calls()[:2], ['install', 'build'])

    def test_harness_target_never_builds_app(self):
        self.run_script('restart', 'harness')
        self.assertEqual(self.calls(), ['install', 'restart restart-test-harness.service'])
        self.write('calls', '')
        self.write('app/page.tsx', 'changed\n')
        self.run_script('restart', 'harness')
        self.assertEqual(self.calls(), ['restart restart-test-harness.service'])

    def test_harness_dependency_install_invalidates_app_build(self):
        self.warm()
        self.write('pnpm-lock.yaml', 'changed\n')
        self.run_script('restart', 'harness')
        self.write('calls', '')
        self.run_script('restart', 'app')
        self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_no_app_deployment(self):
        shutil.rmtree(self.root / 'app')
        self.run_script('restart')
        self.assertEqual(self.calls(), ['install', 'restart restart-test-harness.service'])

    def test_explicit_build_forces_install_and_build(self):
        self.warm()
        self.run_script('build')
        self.assertEqual(self.calls(), ['install', 'build'])

    def test_missing_or_replaced_build_output_rebuilds(self):
        for name in ('BUILD_ID', 'required-server-files.json', 'server', 'static'):
            with self.subTest(name=name):
                self.warm()
                path = self.root / 'app/.next' / name
                shutil.rmtree(path) if path.is_dir() else path.unlink()
                self.run_script('restart', 'app')
                self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])
        self.warm()
        self.write('app/.next/BUILD_ID', 'other-build\n')
        self.run_script('restart', 'app')
        self.assertEqual(self.calls(), ['build', 'restart restart-test-app.service'])

    def test_build_failure_aborts_restart_and_retries(self):
        self.warm()
        self.write('app/page.tsx', 'changed\n')
        self.run_script('restart', success=False, TEST_FAIL_BUILD='1')
        self.assertEqual(self.calls(), ['build'])
        self.write('calls', '')
        self.run_script('restart')
        self.assertEqual(self.calls()[0], 'build')

    def test_install_failure_aborts_restart_and_retries(self):
        self.warm()
        self.write('pnpm-lock.yaml', 'changed\n')
        self.run_script('restart', success=False, TEST_FAIL_INSTALL='1')
        self.assertEqual(self.calls(), ['install'])
        self.write('calls', '')
        self.run_script('restart')
        self.assertEqual(self.calls()[:2], ['install', 'build'])

    def test_forced_build_failure_invalidates_previous_output(self):
        self.warm()
        self.run_script('build', success=False, TEST_FAIL_BUILD='1')
        self.write('calls', '')
        self.run_script('restart')
        self.assertEqual(self.calls()[0], 'build')

    def test_concurrent_restarts_share_one_successful_build(self):
        self.warm()
        self.write('app/page.tsx', 'changed\n')
        command = ['bash', str(self.root / 'scripts/server.sh'), 'restart', 'app']
        processes = [subprocess.Popen(command, env={**self.env, 'TEST_BUILD_DELAY': '0.3'},
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                     for _ in range(2)]
        for process in processes:
            stdout, stderr = process.communicate(timeout=20)
            self.assertEqual(process.returncode, 0, stdout + stderr)
        self.assertEqual(self.calls().count('build'), 1)
        self.assertEqual(self.calls().count('restart restart-test-app.service'), 2)

    def test_source_change_during_build_aborts_restart(self):
        self.run_script('restart', success=False, TEST_CHANGE_SOURCE='1')
        self.assertEqual(self.calls(), ['install', 'build'])
        self.assertFalse((self.root / 'app/.next/.server-build.sha256').exists())

    def test_invalid_target_does_no_work(self):
        self.run_script('restart', 'invalid', success=False)
        self.assertEqual(self.calls(), [])
        self.assertFalse((self.root / 'harness/.secrets').exists())


if __name__ == '__main__':
    unittest.main()
