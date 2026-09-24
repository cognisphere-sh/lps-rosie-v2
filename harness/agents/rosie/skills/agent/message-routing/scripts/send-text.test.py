from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

main = runpy.run_path(str(Path(__file__).with_name('send-text')))['main']


class SendTextTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'message.txt'
        self.text = "Chris's APS quote: $65, $1.95; `literal` $(literal)\nNext line.\n"
        self.path.write_text(self.text)

    def test_agent_text_is_one_literal_argument(self):
        with patch.object(subprocess, 'run') as run:
            run.return_value.returncode = 0
            self.assertEqual(main(['--via', 'agent', '--text-file', str(self.path),
                                   '--thread-id', 'jr-69', '--to-agent', 'rosie']), 0)
            command = run.call_args.args[0]
            self.assertEqual(command[command.index('--message') + 1], self.text)
            self.assertFalse(run.call_args.kwargs['shell'])
            self.assertNotIn('--portal', command)

    def test_portal_is_explicit_and_failure_is_not_retried(self):
        with patch.object(subprocess, 'run') as run:
            run.return_value.returncode = 7
            self.assertEqual(main(['--via', 'webchat', '--text-file', str(self.path),
                                   '--thread-id', 'supplier-test', '--portal']), 7)
            run.assert_called_once()
            command = run.call_args.args[0]
            self.assertIn('--portal', command)
            self.assertEqual(command[command.index('--text') + 1], self.text)

    def test_invalid_inputs_never_send(self):
        with patch.object(subprocess, 'run') as run:
            with self.assertRaises(SystemExit):
                main(['--via', 'agent', '--text-file', str(self.path),
                      '--thread-id', 'jr-69', '--to-agent', 'rosie', '--portal'])
            self.path.write_text(' ')
            self.assertEqual(main(['--via', 'webchat', '--text-file', str(self.path),
                                   '--thread-id', 'jr-69']), 2)
            self.path.unlink()
            self.assertEqual(main(['--via', 'webchat', '--text-file', str(self.path),
                                   '--thread-id', 'jr-69']), 2)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
