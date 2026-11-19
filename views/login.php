<?php /** @var string $csrf @var ?string $error */ ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Sign in · mst·md</title>
  <link rel="icon" href="<?= asset('assets/favicon.svg') ?>" type="image/svg+xml">
  <script nonce="<?= h(csp_nonce()) ?>">
    try { const t = localStorage.getItem('mstmd:theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch {}
  </script>
  <link rel="stylesheet" href="<?= asset('assets/app.css') ?>">
</head>
<body class="login">
  <main class="login__card">
    <div class="login__brand">
      <svg class="icon icon--lg" aria-hidden="true"><use href="assets/icons.svg#i-book-marked"></use></svg>
      <h1>mst<span class="brand__dot">·</span>md</h1>
      <p>Personal notes</p>
    </div>

    <?php if ($error): ?>
      <p class="login__error" role="alert"><?= h($error) ?></p>
    <?php endif; ?>

    <form method="post" action="./" class="login__form">
      <input type="hidden" name="action" value="login">
      <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
      <label class="field">
        <span>Username</span>
        <input type="text" name="username" required autofocus autocomplete="username" autocapitalize="none" spellcheck="false">
      </label>
      <label class="field">
        <span>Password</span>
        <input type="password" name="password" required autocomplete="current-password">
      </label>
      <button type="submit" class="btn btn--primary btn--block">Sign in</button>
    </form>
  </main>
</body>
</html>
