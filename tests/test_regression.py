import ast
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import main


ROOT = Path(__file__).resolve().parents[1]


class DuplicateDefinitionTests(unittest.TestCase):
    def test_no_duplicate_top_level_definitions_in_main(self):
        tree = ast.parse((ROOT / "main.py").read_text(encoding="utf-8"))
        seen = {}
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                seen.setdefault(node.name, []).append(node.lineno)
        duplicates = {name: lines for name, lines in seen.items() if len(lines) > 1}
        self.assertEqual(duplicates, {})

    def test_deduplicated_functions_keep_user_id_support(self):
        self.assertTrue("user_id" in main.load_projects.__code__.co_varnames)
        self.assertTrue("user_id" in main.new_canvas.__code__.co_varnames)
        self.assertTrue("user_id" in main.list_canvases.__code__.co_varnames)


class CanvasCrudRoundtripTests(unittest.TestCase):
    """Exercise the surviving (user_id) project/canvas CRUD layer against local files."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        data = self.root / "data"
        canvases = data / "canvases"
        canvases.mkdir(parents=True)
        self.patches = [
            patch.object(main, "DATA_DIR", str(data)),
            patch.object(main, "CANVAS_DIR", str(canvases)),
            patch.object(main, "PROJECTS_PATH", str(data / "projects.json")),
            patch.object(main, "CANVAS_LOCK", threading.RLock()),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def test_canvas_roundtrip_and_listing(self):
        canvas = main.new_canvas("测试画布", project="default")
        loaded = main.load_canvas(canvas["id"])
        self.assertEqual(loaded["title"], "测试画布")
        self.assertEqual(loaded["kind"], "classic")
        self.assertEqual(loaded["project"], "default")

        records = main.list_canvases()
        self.assertEqual([rec["id"] for rec in records], [canvas["id"]])
        self.assertEqual(records[0]["title"], "测试画布")

        stored = main.load_canvas(canvas["id"])
        stored["title"] = "改名了"
        main.save_canvas(stored)
        self.assertEqual(main.load_canvas(canvas["id"])["title"], "改名了")

    def test_project_crud(self):
        proj = main.new_project("项目A")
        self.assertEqual(proj["name"], "项目A")
        projects = main.list_projects()
        self.assertTrue(any(p["id"] == "default" for p in projects))
        self.assertTrue(any(p["id"] == proj["id"] for p in projects))

    def test_default_project_is_idempotent(self):
        first = main.list_projects()
        second = main.list_projects()
        self.assertEqual(
            [p["id"] for p in first],
            [p["id"] for p in second],
        )
        self.assertEqual(len(main.load_projects()), len(second))


class ApimartMidjourneyRoutingTests(unittest.TestCase):
    """APIMart 的 Midjourney 必须走 /v1/midjourney/generations 专用接口，
    而不是通用 /v1/images/generations（否则上游返回 get_channel_failed 500）。"""

    def setUp(self):
        self.provider_patch = patch.object(main, "provider_env_key_value", return_value="test-key")
        self.provider_patch.start()

    def tearDown(self):
        self.provider_patch.stop()

    def _fake_post_run(self, responses):
        import asyncio

        class FakeResponse:
            def __init__(self, status_code, payload, text):
                self.status_code = status_code
                self._payload = payload
                self.text = text

            def json(self):
                return self._payload

            def raise_for_status(self):
                if self.status_code >= 400:
                    raise httpx_error(self.status_code)

        def httpx_error(status):
            response = FakeResponse(status, {}, "")
            return main.httpx.HTTPStatusError("request failed", request=None, response=response)

        class FakeClient:
            def __init__(self):
                self.posts = []

            async def post(self, url, headers=None, json=None, **kwargs):
                self.posts.append((url, json))
                item = responses.pop(0) if len(responses) > 1 else responses[0]
                return FakeResponse(item["status"], item.get("payload", {}), item.get("text", ""))

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

        client = FakeClient()

        async def run():
            return await main.generate_ai_image(
                "a cat in a hat",
                "1024x1024",
                "high",
                self.model,
                provider_id="apimart",
                wait_for_async=False,
            )

        with patch.object(main.httpx, "AsyncClient", return_value=client):
            result = asyncio.run(run())
        return client.posts, result

    def test_midjourney_uses_dedicated_endpoint_and_clean_body(self):
        self.model = "midjourney"
        posts, result = self._fake_post_run(
            [{"status": 200, "payload": {"data": {"task_id": "mj_task_1"}}}]
        )
        self.assertEqual(len(posts), 1)
        url, body = posts[0]
        self.assertEqual(url, "https://api.apimart.ai/v1/midjourney/generations")
        self.assertEqual(body["model"], "midjourney")
        self.assertEqual(body["size"], "1:1")
        self.assertNotIn("resolution", body)
        self.assertNotIn("official_fallback", body)
        self.assertNotIn("n", body)
        self.assertIsNone(result[0])
        self.assertEqual(main.extract_task_id(result[1]), "mj_task_1")

    def test_midjourney_retries_get_channel_failed(self):
        self.model = "midjourney"
        async def _noop_sleep(*args, **kwargs):
            return None

        with patch.object(main.asyncio, "sleep", new=_noop_sleep):
            posts, _result = self._fake_post_run(
                [
                    {"status": 500, "text": '{"error":{"code":"get_channel_failed","message":"Please wait and try again later."}}'},
                    {"status": 500, "text": '{"error":{"code":"get_channel_failed","message":"Please wait and try again later."}}'},
                    {"status": 200, "payload": {"data": {"task_id": "mj_task_2"}}},
                ]
            )
        self.assertEqual(len(posts), 3)
        self.assertTrue(all(url == "https://api.apimart.ai/v1/midjourney/generations" for url, _ in posts))

    def test_other_apimart_models_still_use_generic_endpoint(self):
        self.model = "gpt-image-2"
        posts, _result = self._fake_post_run(
            [{"status": 200, "payload": {"data": [{"url": "https://example.com/img.png"}]}}]
        )
        self.assertEqual(len(posts), 1)
        url, body = posts[0]
        self.assertEqual(url, "https://api.apimart.ai/v1/images/generations")
        self.assertEqual(body["model"], "gpt-image-2")

    def test_get_channel_failed_has_friendly_message(self):
        detail = main.friendly_image_error_detail(
            '{"error":{"code":"get_channel_failed","message":"Please wait and try again later."}}',
            "1:1",
            "midjourney",
        )
        self.assertIn("get_channel_failed", detail)
        self.assertIn("稍后重试", detail)


if __name__ == "__main__":
    unittest.main()
