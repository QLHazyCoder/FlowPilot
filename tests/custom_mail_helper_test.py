import importlib.util
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "custom_mail_helper.py"
spec = importlib.util.spec_from_file_location("custom_mail_helper", MODULE_PATH)
custom_mail_helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(custom_mail_helper)


class CustomMailHelperRandomEmailTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "generated-emails.sqlite3")
        custom_mail_helper.RANDOM_EMAIL_DB_PATH = self.db_path
        custom_mail_helper.RANDOM_EMAIL_MAX_COUNT = 3

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_generates_one_unique_email_by_default_and_persists_it(self):
        result = custom_mail_helper.generate_random_emails({"domain": "example.com"})

        self.assertEqual(result["emails"], [result["email"]])
        self.assertEqual(len(result["emails"]), 1)
        self.assertRegex(result["email"], r"^[a-z]{8,12}@example\.com$")

        with sqlite3.connect(self.db_path) as connection:
            rows = connection.execute("SELECT email, domain FROM generated_emails").fetchall()
        self.assertEqual(rows, [(result["email"], "example.com")])

    def test_generates_requested_count_without_duplicates(self):
        result = custom_mail_helper.generate_random_emails({"domain": "example.com", "n": 3})

        self.assertEqual(len(result["emails"]), 3)
        self.assertEqual(len(set(result["emails"])), 3)
        for email in result["emails"]:
            self.assertRegex(email, r"^[a-z]{8,12}@example\.com$")

        with sqlite3.connect(self.db_path) as connection:
            count = connection.execute("SELECT COUNT(*) FROM generated_emails").fetchone()[0]
        self.assertEqual(count, 3)

    def test_rejects_count_above_configured_maximum(self):
        with self.assertRaisesRegex(RuntimeError, "must be <= 3"):
            custom_mail_helper.generate_random_emails({"domain": "example.com", "n": 4})

    def test_rejects_invalid_domain(self):
        with self.assertRaisesRegex(RuntimeError, "Invalid domain"):
            custom_mail_helper.generate_random_emails({"domain": "not a domain"})


if __name__ == "__main__":
    unittest.main()
