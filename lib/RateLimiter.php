<?php
/**
 * Login throttling per client IP, stored in a small JSON file.
 * (The previous version counted attempts in the session, which an attacker
 * could reset simply by dropping the cookie.)
 */
declare(strict_types=1);

final class RateLimiter
{
    private string $file;

    public function __construct(string $dataDir, private int $max, private int $window)
    {
        if (!is_dir($dataDir)) {
            @mkdir($dataDir, 0750, true);
        }
        $this->file = $dataDir . '/login-attempts.json';
    }

    /** Seconds until the IP may try again, or 0 if allowed. */
    public function retryAfter(string $ip): int
    {
        return $this->update(function (array &$db) use ($ip): int {
            $hits = $db[$this->key($ip)] ?? [];
            if (count($hits) < $this->max) {
                return 0;
            }
            return max(1, min($hits) + $this->window - time());
        });
    }

    public function fail(string $ip): void
    {
        $this->update(function (array &$db) use ($ip): int {
            $db[$this->key($ip)][] = time();
            return 0;
        });
    }

    public function clear(string $ip): void
    {
        $this->update(function (array &$db) use ($ip): int {
            unset($db[$this->key($ip)]);
            return 0;
        });
    }

    private function key(string $ip): string
    {
        return hash('sha256', $ip);
    }

    private function update(callable $fn): int
    {
        $fh = @fopen($this->file, 'c+');
        if ($fh === false) {
            error_log('mst-md: cannot open rate-limit file ' . $this->file);
            return 0; // fail open rather than lock the owner out
        }
        try {
            flock($fh, LOCK_EX);
            $raw = stream_get_contents($fh);
            $db = json_decode($raw ?: '{}', true) ?: [];
            // Drop expired entries
            $cutoff = time() - $this->window;
            foreach ($db as $k => $hits) {
                $db[$k] = array_values(array_filter($hits, fn($t) => $t > $cutoff));
                if (!$db[$k]) {
                    unset($db[$k]);
                }
            }
            $result = $fn($db);
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, json_encode($db));
            fflush($fh);
            return $result;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
