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


if __name__ == "__main__":
    unittest.main()
