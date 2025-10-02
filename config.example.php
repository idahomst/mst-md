<?php
// Configuration
define('USERNAME', 'admin'); // Change this

// To generate a new password hash:
//     php -r "echo password_hash('your-new-password', PASSWORD_DEFAULT);"

define('PASSWORD', '$2y$10$tAMJzy8GMHsIN/EOcRyEseBr5jjUn3anw.3pGEhkf.CDUoA20biEC'); // Change this password hash

// Or uncomment next line if you wish to see your password in clear text:
//define('PASSWORD', password_hash('changeme', PASSWORD_DEFAULT)); // Change this password

// Library versions
define('MARKED_VERSION', '16.3.0');
define('HIGHLIGHT_JS_VERSION', '11.11.1');
?>
