import pathlib
import stat
import tempfile
import unittest
import zipfile
from audit import safe_path, inspect_archive

class ArchiveTests(unittest.TestCase):
    def test_paths(self):
        for value in ('../secret', '/etc/secret', 'C:/secret', 'ok/../secret', 'ok\\bad', 'CON.txt', 'file:stream', '.env.production', 'a/./b', 'a//b', 'a/b.'):
            self.assertFalse(safe_path(value), value)
        self.assertTrue(safe_path('WarLike Mail/WarLike-Mail.exe'))

    def test_real_zip_and_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp) / 'release.zip'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('WarLike-Mail/README.txt', 'safe')
            self.assertEqual(inspect_archive(path)['entries'], 1)
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('../escape.txt', 'bad')
            with self.assertRaises(ValueError):
                inspect_archive(path)

    def test_symlink_and_case_collision(self):
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp) / 'release.zip'
            link = zipfile.ZipInfo('link'); link.create_system = 3; link.external_attr = (stat.S_IFLNK | 0o777) << 16
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr(link, '../outside')
            with self.assertRaises(ValueError):
                inspect_archive(path)
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('README.txt', 'one'); z.writestr('readme.TXT', 'two')
            with self.assertRaises(ValueError):
                inspect_archive(path)

if __name__ == '__main__':
    unittest.main()
