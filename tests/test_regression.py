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

    def test_extract_images_handles_apimart_midjourney_four_outputs(self):
        payload = {
            "data": {
                "task_id": "mj_task_x",
                "status": "SUCCESS",
                "result": {
                    "images": [
                        {"url": "https://cdn.apimart.ai/jobs/1/abc"},
                        {"url": "https://cdn.apimart.ai/jobs/2/def"},
                        {"url": "https://cdn.apimart.ai/jobs/3/ghi"},
                        {"url": "https://cdn.apimart.ai/jobs/4/jkl"},
                    ]
                }
            }
        }
        items = main.extract_images(payload)
        self.assertEqual(len(items), 4)
        self.assertTrue(all(item["type"] == "url" for item in items))
        self.assertEqual(items[0]["value"], "https://cdn.apimart.ai/jobs/1/abc")
        self.assertEqual(items[3]["value"], "https://cdn.apimart.ai/jobs/4/jkl")


class CanvasPerfHelpersTests(unittest.TestCase):
    """首屏优化新增辅助函数的单元测试。"""

    def test_asset_path_mapping_and_local_exists(self):
        import os
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            existing = os.path.join(tmp, "a.png")
            with open(existing, "wb") as fh:
                fh.write(b"x")
            with patch.object(main, "ASSETS_DIR", tmp):
                self.assertEqual(main.canvas_asset_url_to_local_path("/assets/a.png"), existing)
                self.assertTrue(main.canvas_asset_exists("/assets/a.png"))
                self.assertFalse(main.canvas_asset_exists("/assets/missing.png"))
                self.assertIsNone(main.canvas_asset_url_to_local_path("/assets/../secret"))
                self.assertTrue(main.canvas_asset_exists("https://cdn.example.com/x.png"))
                self.assertTrue(main.canvas_asset_exists("data:image/png;base64,AAAA"))

    def test_asset_check_uses_head_not_download(self):
        import os
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(main, "ASSETS_DIR", tmp), \
                patch.object(main.storage_r2, "is_configured", return_value=True), \
                patch.object(main.storage_r2, "object_exists_status", return_value=True) as head, \
                patch.object(main.storage_r2, "download_bytes") as download:
                self.assertTrue(main.canvas_asset_exists("/assets/a.png"))
                head.assert_called_once()
                download.assert_not_called()

    def test_server_timing_header(self):
        st = main.ServerTiming()
        st.mark("auth", dur=1.5)
        st.mark("query", dur=2.25, desc="kv_get")
        header = st.header()
        self.assertIn("auth;dur=1.5", header)
        self.assertIn("query;dur=2.2", header)
        self.assertIn('desc="kv_get"', header)

    def test_preview_cache_seed_paths(self):
        first = main.media_preview_cache_paths_for_seed("key", 512, 1, 2)
        second = main.media_preview_cache_paths_for_seed("key", 512, 1, 3)
        self.assertNotEqual(first, second)
        self.assertTrue(str(first[0]).endswith(".webp"))
        self.assertTrue(str(first[1]).endswith(".png"))

    def test_meta_float(self):
        self.assertEqual(main._meta_float("1.5"), 1.5)
        self.assertIsNone(main._meta_float(""))
        self.assertIsNone(main._meta_float("abc"))


class CanvasApiLogsSplitTests(unittest.TestCase):
    """GET /api/canvases/{id} 默认不返回 logs；日志独立接口分页；PUT 在 logs=None 时保留原日志。"""

    def setUp(self):
        from fastapi.testclient import TestClient
        self.user_patch = patch.object(main, "require_current_user", return_value={"id": "u1"})
        self.user_patch.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.user_patch.stop()

    def _canvas(self):
        return {
            "id": "c1",
            "title": "T",
            "kind": "classic",
            "nodes": [{"id": "n1", "type": "prompt"}],
            "connections": [],
            "viewport": {"x": 0, "y": 0, "scale": 1},
            "logs": [{"id": "l1", "status": "success"}],
            "updated_at": 123,
        }

    def test_get_canvas_excludes_logs_by_default(self):
        with patch.object(main, "load_canvas", return_value=self._canvas()):
            response = self.client.get("/api/canvases/c1")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("logs", response.json()["canvas"])
        self.assertIn("ETag", response.headers)
        self.assertIn("Server-Timing", response.headers)

    def test_get_canvas_can_include_logs(self):
        with patch.object(main, "load_canvas", return_value=self._canvas()):
            response = self.client.get("/api/canvases/c1", params={"include_logs": 1})
        self.assertEqual(response.status_code, 200)
        self.assertIn("logs", response.json()["canvas"])

    def test_etag_returns_304(self):
        with patch.object(main, "load_canvas", return_value=self._canvas()):
            first = self.client.get("/api/canvases/c1")
            etag = first.headers.get("ETag")
            self.assertTrue(etag)
            second = self.client.get("/api/canvases/c1", headers={"If-None-Match": etag})
        self.assertEqual(second.status_code, 304)

    def test_logs_endpoint_paginated(self):
        logs = [{"id": f"l{i}"} for i in range(120)]
        with patch.object(main, "load_canvas", return_value={**self._canvas(), "logs": logs}):
            response = self.client.get("/api/canvases/c1/logs", params={"limit": 50, "offset": 0})
        data = response.json()
        self.assertEqual(len(data["logs"]), 50)
        self.assertEqual(data["total"], 120)
        self.assertEqual(data["offset"], 0)

    def test_put_preserves_logs_when_null(self):
        saved = {}

        def fake_save(canvas):
            saved["canvas"] = canvas

        payload = {
            "title": "T",
            "icon": "layers",
            "nodes": [],
            "connections": [],
            "viewport": {},
            "logs": None,
            "settings": {},
            "client_id": "",
            "base_updated_at": 0,
        }
        async def _noop_broadcast(*args, **kwargs):
            return None

        with patch.object(main, "load_canvas", return_value=self._canvas()), \
            patch.object(main, "save_canvas", side_effect=fake_save), \
            patch.object(main.manager, "broadcast_canvas_updated", new=_noop_broadcast):
            response = self.client.put("/api/canvases/c1", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(saved["canvas"]["logs"], [{"id": "l1", "status": "success"}])


if __name__ == "__main__":
    unittest.main()
