<?php
/**
 * File-system note repository. Every path coming from the client is a
 * "relative path" like "work/ideas.md"; it is validated segment by segment
 * and resolved strictly inside the notes root. Only *.md files are touched.
 */
declare(strict_types=1);

final class NotesError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400, public readonly array $extra = [])
    {
        parent::__construct($message);
    }
}

final class Notes
{
    private const MAX_NOTE_BYTES = 5 * 1024 * 1024;
    private const MAX_SEARCH_RESULTS = 50;

    private string $root;

    public function __construct(string $root)
    {
        if (!is_dir($root) && !mkdir($root, 0750, true) && !is_dir($root)) {
            throw new NotesError('Notes directory cannot be created', 500);
        }
        $real = realpath($root);
        if ($real === false) {
            throw new NotesError('Notes directory is not accessible', 500);
        }
        $this->root = $real;
    }

    /* -------------------------------------------------------------- */
    /* Path handling                                                   */
    /* -------------------------------------------------------------- */

    /** Validate and normalise a client path. Returns "" for the root. */
    public static function clean(string $path): string
    {
        $path = trim(str_replace('\\', '/', $path), '/');
        if ($path === '') {
            return '';
        }
        $parts = explode('/', $path);
        foreach ($parts as $p) {
            self::assertName($p);
        }
        return implode('/', $parts);
    }

    /** A single file or folder name. */
    public static function assertName(string $name): void
    {
        if ($name === '' || $name === '.' || $name === '..'
            || str_starts_with($name, '.')
            || preg_match('/[\x00-\x1F\x7F\/\\\\:*?"<>|]/u', $name)
            || mb_strlen($name) > 120
            || !mb_check_encoding($name, 'UTF-8')) {
            throw new NotesError('Invalid name: names may not start with a dot or contain / \\ : * ? " < > |', 422);
        }
    }

    private static function isNote(string $rel): bool
    {
        return strtolower(pathinfo($rel, PATHINFO_EXTENSION)) === 'md';
    }

    private static function withMd(string $name): string
    {
        return self::isNote($name) ? $name : $name . '.md';
    }

    /** Absolute path for a relative one; refuses anything that escapes the root or is a symlink. */
    private function abs(string $rel): string
    {
        $abs = $rel === '' ? $this->root : $this->root . '/' . $rel;
        // Walk existing ancestors and make sure none of them is a symlink.
        $check = $abs;
        while ($check !== $this->root && strlen($check) > strlen($this->root)) {
            if (is_link($check)) {
                throw new NotesError('Symbolic links are not allowed', 403);
            }
            $check = dirname($check);
        }
        return $abs;
    }

    private function note(string $path): array
    {
        $rel = self::clean($path);
        if ($rel === '' || !self::isNote($rel)) {
            throw new NotesError('Only .md notes can be opened', 422);
        }
        return [$rel, $this->abs($rel)];
    }

    /* -------------------------------------------------------------- */
    /* Queries                                                         */
    /* -------------------------------------------------------------- */

    public function tree(string $rel = ''): array
    {
        $dir = $this->abs($rel);
        $items = [];
        foreach (scandir($dir) ?: [] as $name) {
            if ($name[0] === '.') {
                continue;
            }
            $childRel = $rel === '' ? $name : "$rel/$name";
            $childAbs = "$dir/$name";
            if (is_link($childAbs)) {
                continue;
            }
            if (is_dir($childAbs)) {
                $items[] = ['type' => 'folder', 'name' => $name, 'path' => $childRel, 'children' => $this->tree($childRel)];
            } elseif (self::isNote($name)) {
                $items[] = ['type' => 'file', 'name' => $name, 'path' => $childRel, 'mtime' => filemtime($childAbs)];
            }
        }
        usort($items, fn($a, $b) => [$a['type'] !== 'folder', mb_strtolower($a['name'])]
                                <=> [$b['type'] !== 'folder', mb_strtolower($b['name'])]);
        return $items;
    }

    public function read(string $path): array
    {
        [$rel, $abs] = $this->note($path);
        if (!is_file($abs)) {
            throw new NotesError('Note not found', 404);
        }
        $content = (string) file_get_contents($abs);
        return ['path' => $rel, 'name' => basename($rel), 'content' => $content, 'version' => self::version($content)];
    }

    public function search(string $query): array
    {
        $query = trim($query);
        if (mb_strlen($query) < 2) {
            return [];
        }
        $results = [];
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->root, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            /** @var SplFileInfo $file */
            if (!$file->isFile() || $file->isLink() || !self::isNote($file->getFilename())) {
                continue;
            }
            $rel = substr($file->getPathname(), strlen($this->root) + 1);
            if (str_contains("/$rel", '/.')) {
                continue; // hidden folders
            }
            $content = (string) file_get_contents($file->getPathname());
            $nameHit = mb_stripos($file->getFilename(), $query) !== false;
            $matches = [];
            foreach (preg_split('/\R/u', $content) ?: [] as $i => $line) {
                $pos = mb_stripos($line, $query);
                if ($pos === false) {
                    continue;
                }
                $start = max(0, $pos - 40);
                $matches[] = [
                    'line'   => $i + 1,
                    'text'   => ($start > 0 ? '…' : '') . mb_substr($line, $start, 140),
                ];
                if (count($matches) >= 3) {
                    break;
                }
            }
            if ($nameHit || $matches) {
                $results[] = ['path' => $rel, 'name' => $file->getFilename(), 'nameHit' => $nameHit, 'matches' => $matches, 'mtime' => $file->getMTime()];
            }
        }
        usort($results, fn($a, $b) => [$b['nameHit'], $b['mtime']] <=> [$a['nameHit'], $a['mtime']]);
        return array_slice($results, 0, self::MAX_SEARCH_RESULTS);
    }

    /* -------------------------------------------------------------- */
    /* Commands                                                        */
    /* -------------------------------------------------------------- */

    /** Version token of a note: hash of its content (robust, unlike 1-second mtimes). */
    public static function version(string $content): string
    {
        return hash('sha256', $content);
    }

    /**
     * Save a note. $baseVersion is the version the client loaded; if the file
     * changed on disk since then a 409 is raised (unless $force).
     */
    public function save(string $path, string $content, ?string $baseVersion, bool $force = false): array
    {
        [$rel, $abs] = $this->note($path);
        if (strlen($content) > self::MAX_NOTE_BYTES) {
            throw new NotesError('Note is too large (max 5 MB)', 413);
        }
        if (!is_dir(dirname($abs))) {
            throw new NotesError('Folder does not exist', 404);
        }
        if (!$force && $baseVersion !== null && is_file($abs)
            && !hash_equals(self::version((string) file_get_contents($abs)), $baseVersion)) {
            throw new NotesError('The note was changed elsewhere since you opened it', 409);
        }
        $this->atomicWrite($abs, $content);
        return ['path' => $rel, 'version' => self::version($content)];
    }

    public function createNote(string $folder, string $name): array
    {
        $folder = self::clean($folder);
        self::assertName($name);
        $rel = ltrim("$folder/" . self::withMd($name), '/');
        $abs = $this->abs($rel);
        if (!is_dir(dirname($abs))) {
            throw new NotesError('Folder does not exist', 404);
        }
        if (file_exists($abs)) {
            throw new NotesError('A note with that name already exists', 409);
        }
        $title = pathinfo($rel, PATHINFO_FILENAME);
        $this->atomicWrite($abs, "# $title\n\n");
        return ['path' => $rel];
    }

    public function createFolder(string $parent, string $name): array
    {
        $parent = self::clean($parent);
        self::assertName($name);
        $rel = ltrim("$parent/$name", '/');
        $abs = $this->abs($rel);
        if (!is_dir(dirname($abs))) {
            throw new NotesError('Parent folder does not exist', 404);
        }
        if (file_exists($abs)) {
            throw new NotesError('A folder with that name already exists', 409);
        }
        if (!mkdir($abs, 0750)) {
            throw new NotesError('Folder could not be created', 500);
        }
        return ['path' => $rel];
    }

    /** Rename and/or move a note or folder. $to is the full new relative path. */
    public function move(string $from, string $to): array
    {
        $from = self::clean($from);
        $to = self::clean($to);
        if ($from === '' || $to === '') {
            throw new NotesError('Invalid path', 422);
        }
        $src = $this->abs($from);
        if (!file_exists($src)) {
            throw new NotesError('Not found', 404);
        }
        if (is_file($src)) {
            if (!self::isNote($from)) {
                throw new NotesError('Only .md notes can be renamed', 422);
            }
            $to = self::withMd($to);
        } elseif ($to === $from || str_starts_with("$to/", "$from/")) {
            throw new NotesError('A folder cannot be moved into itself', 422);
        }
        $dst = $this->abs($to);
        if (!is_dir(dirname($dst))) {
            throw new NotesError('Target folder does not exist', 404);
        }
        // Case-only renames on case-insensitive filesystems: allow.
        if (file_exists($dst) && strcasecmp($from, $to) !== 0) {
            throw new NotesError('Something with that name already exists', 409);
        }
        if (!rename($src, $dst)) {
            throw new NotesError('Rename failed', 500);
        }
        return ['path' => $to];
    }

    public function delete(string $path): void
    {
        $rel = self::clean($path);
        if ($rel === '') {
            throw new NotesError('The notes root cannot be deleted', 422);
        }
        $abs = $this->abs($rel);
        if (is_file($abs)) {
            if (!self::isNote($rel)) {
                throw new NotesError('Only .md notes can be deleted', 422);
            }
            unlink($abs);
            return;
        }
        if (!is_dir($abs)) {
            throw new NotesError('Not found', 404);
        }
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($abs, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $f) {
            /** @var SplFileInfo $f */
            // Never follow links: remove the link itself.
            if ($f->isLink() || $f->isFile()) {
                unlink($f->getPathname());
            } else {
                rmdir($f->getPathname());
            }
        }
        rmdir($abs);
    }

    private function atomicWrite(string $abs, string $content): void
    {
        $tmp = dirname($abs) . '/.' . basename($abs) . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (file_put_contents($tmp, $content, LOCK_EX) === false) {
            throw new NotesError('Write failed — check permissions of the notes folder', 500);
        }
        if (is_file($abs)) {
            @chmod($tmp, fileperms($abs) & 0777);
        }
        if (!rename($tmp, $abs)) {
            @unlink($tmp);
            throw new NotesError('Write failed', 500);
        }
    }
}
