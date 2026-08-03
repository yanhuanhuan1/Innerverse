import unittest
from unittest.mock import patch

import main


class RateLimitTests(unittest.TestCase):
    def setUp(self):
        main._rate_buckets.clear()

    def _request(self, ip="1.2.3.4"):
        req = type("R", (), {"headers": {"x-forwarded-for": ip}, "client": None})()
        return req

    def test_allows_requests_under_limit(self):
        req = self._request()
        for _ in range(10):
            self.assertTrue(main.auth_rate_limit_allowed(req, "password_login", "a@example.com"))

    def test_blocks_after_limit(self):
        req = self._request()
        for _ in range(10):
            main.auth_rate_limit_allowed(req, "password_login", "a@example.com")
        self.assertFalse(main.auth_rate_limit_allowed(req, "password_login", "a@example.com"))

    def test_different_email_is_independent(self):
        req = self._request()
        for _ in range(10):
            main.auth_rate_limit_allowed(req, "password_login", "a@example.com")
        self.assertTrue(main.auth_rate_limit_allowed(req, "password_login", "b@example.com"))

    def test_different_scope_is_independent(self):
        req = self._request()
        for _ in range(10):
            main.auth_rate_limit_allowed(req, "password_login", "a@example.com")
        self.assertTrue(main.auth_rate_limit_allowed(req, "email_start", "a@example.com"))

    def test_window_expires_and_allows_again(self):
        req = self._request()
        fake_time = [1000.0]
        with patch.object(main.time, "time", side_effect=lambda: fake_time[0]):
            for _ in range(10):
                main.auth_rate_limit_allowed(req, "password_login", "a@example.com")
            self.assertFalse(main.auth_rate_limit_allowed(req, "password_login", "a@example.com"))
            fake_time[0] += 301
            self.assertTrue(main.auth_rate_limit_allowed(req, "password_login", "a@example.com"))

    def test_ensure_raises_429_after_limit(self):
        req = self._request()
        for _ in range(10):
            main.auth_rate_limit_allowed(req, "email_verify", "a@example.com")
        with self.assertRaises(main.HTTPException) as caught:
            main.ensure_auth_rate_limit(req, "email_verify", "a@example.com")
        self.assertEqual(caught.exception.status_code, 429)

    def test_request_client_ip_prefers_forwarded_header(self):
        req = self._request("203.0.113.9")
        self.assertEqual(main.request_client_ip(req), "203.0.113.9")
        multi = type("R", (), {"headers": {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}, "client": None})()
        self.assertEqual(main.request_client_ip(multi), "1.2.3.4")


class CorsConfigTests(unittest.TestCase):
    def test_default_origins_are_local_dev(self):
        self.assertIn("http://127.0.0.1:3000", main.ALLOWED_ORIGINS)
        self.assertIn("http://localhost:3000", main.ALLOWED_ORIGINS)
        self.assertNotIn("*", main.ALLOWED_ORIGINS)

    def test_parse_allowed_origins(self):
        self.assertEqual(
            main.parse_allowed_origins("https://a.example, https://b.example/ "),
            ["https://a.example", "https://b.example"],
        )
        self.assertEqual(
            main.parse_allowed_origins(""),
            ["http://127.0.0.1:3000", "http://localhost:3000"],
        )


class VersionTests(unittest.TestCase):
    def test_app_version_matches_version_file(self):
        with open("VERSION", encoding="utf-8") as f:
            expected = (f.read().strip().splitlines() or [""])[0].strip()
        self.assertEqual(main.APP_VERSION, expected)

    def test_current_app_version_uses_single_source(self):
        self.assertEqual(main.current_app_version(), main.APP_VERSION)

    def test_load_app_version_fallback(self):
        with patch.object(main.os.path, "join", return_value="/nonexistent/VERSION"):
            self.assertEqual(main.load_app_version(), "2026.07.23")


class StorageModuleLoggingTests(unittest.TestCase):
    def test_storage_modules_have_loggers(self):
        import storage_db
        import storage_r2

        self.assertTrue(hasattr(storage_db, "logger"))
        self.assertTrue(hasattr(storage_r2, "logger"))


if __name__ == "__main__":
    unittest.main()
