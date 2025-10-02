
# Markdown Editor / Viewer 

A sleek, personal markdown editor for building your knowledge base. Runs on any Apache web server with PHP support.

## Features

- [x] **Authentication** - Secure login to protect your notes (single user so far)
- [x] **File Management** - Create, edit, delete files and folders
- [x] **Dual Panel Editor** - Live markdown preview as you type
- [x] **Mobile device friendly** - Detects small displays and switch the UI accordingly
- [x] **Syntax Highlighting** - Support for Python, Bash, YAML, JSON, JavaScript, PHP, SQL, and more
- [x] **Auto-save** - Automatically saves your work as you type
- [x] **Light/Dark Theme** - Toggle between themes for comfortable viewing
- [x] **Flexible Layout** - Switch between horizontal and vertical split views
- [x] **Search** - Full-text search across all your notes
- [x] **File Tree Navigation** - Browse your notes with a folder structure
- [x] **No Database** - All notes stored as `.md` files on the filesystem

## Requirements

- Apache web server (or any PHP-capable web server)
- PHP 7.4 or higher
- Write permissions for the web server in the application directory

### PHP Extensions

The following PHP extensions are required:

- `php-mbstring`: For multi-byte string support.
- `php-json`: For handling JSON data (usually enabled by default).
- `php-session`: For session management (usually enabled by default).

On a Debian-based system, you can install them with:
```bash
sudo apt install php8.2-mbstring php8.2-json  # depends on php version you have
```

## Installation

1. **Copy files to your web server**
   ```bash
   # Clone the repo and copy the entire directory to your web root
   git clone ...
   cd mst-md
   scp -r * -i /path/to/your/ssh-key <your-username>@<your-server> /var/www/html/
   ```

2. **Set permissions**
   ```bash
   cd /var/www/html/md
   chmod 644 .
   mkdir -p notes
   chown www-data:www-data notes  # Adjust user/group for your system
   chmod 755 notes
   ```

3. **Configure authentication**

   Create a `config.php` file by copying `config.example.php` and edit it to change the default credentials:

   ```php
   define('USERNAME', 'admin'); // Change this
   define('PASSWORD', password_hash('changeme', PASSWORD_DEFAULT)); // Change this password
   ```

   To generate a new password hash:
   ```bash
   php -r "echo password_hash('your-new-password', PASSWORD_DEFAULT);"
   ```

4. **Access the application**

   Open your browser and navigate to:
   ```
   http://your-server/md/
   ```

   Default login:
   - Username: `admin`
   - Password: `changeme`

## Usage

### Creating Notes

- Click the **📄+** button to create a new file
- Click the **📁+** button to create a new folder
- Files are automatically saved as you type (after 2 seconds of inactivity)
- Use **Ctrl+S** (or **Cmd+S** on Mac) to manually save

### Organizing Notes

- All notes are stored in the `notes/` directory as `.md` files
- Create folders to organize your notes hierarchically
- Click on files in the sidebar to open them
- Delete files/folders using the 🗑️ button (hover over items to see it)

### Search

- Use the search box in the header to search across all notes
- Searches both file names and content
- Click on search results to open the file

### Themes & Layout

- 🌙/☀️ button: Toggle between light and dark theme
- ⬌ button: Switch between horizontal and vertical layout
- Your preferences are saved in browser localStorage

### Markdown Features

The editor supports full GitHub-flavored markdown:

- Headings, lists, links, images
- Code blocks with syntax highlighting
- Tables, blockquotes, horizontal rules
- And more!

## Keyboard Shortcuts

- **Ctrl+S** / **Cmd+S**: Save current file
- **Escape**: Close modals

## File Structure

```
md/
├── index.php          # Main application and authentication
├── login.html         # Login page template
├── config.php         # User configuration (credentials)
├── api.php            # Backend API for file operations
├── app.js             # Frontend JavaScript
├── style.css          # Application styles
├── notes/             # Your markdown files (auto-created)
│   ├── file1.md
│   ├── folder1/
│   │   └── file2.md
│   └── ...
└── README.md          # This file
```

## Security Notes

1. **Change default credentials** in `config.php` immediately after installation.
2. The application validates all file paths to prevent directory traversal attacks.
3. All state-changing actions are protected by **CSRF tokens**.
4. The application regenerates the session ID on login to prevent **session fixation**.
5. A basic **brute-force protection** is in place to limit login attempts.
6. Only `.md` files are shown in the file tree.
7. Sessions expire when the browser is closed.
8. Consider using **HTTPS** for production deployments.


## Troubleshooting

### Permission Issues

If you see errors about writing files:

```bash
# Make sure the web server can write to the notes directory
chown -R www-data:www-data notes/
chmod -R 755 notes/
```

### Session Issues

If you're logged out immediately:

1. Check that PHP sessions are working: `php -i | grep session.save_path`
2. Ensure the session directory is writable
3. Check your `php.ini` session settings

### Files Not Showing

1. Ensure files have `.md` extension
2. Check file permissions
3. Refresh the file tree by reloading the page

## Customization

### Changing Colors

Edit `style.css` and modify the CSS variables in `:root` (light theme) and `[data-theme="dark"]` (dark theme).

### Adding More Language Support

The editor already includes syntax highlighting for:
- Python
- Bash
- YAML
- JSON
- JavaScript
- PHP
- SQL

To add more languages, add the appropriate highlight.js script in `index.php`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/LANGUAGE.min.js"></script>
```

### Adjusting Auto-save Delay

Edit `app.js` and change the timeout value:

```javascript
autoSaveTimeout = setTimeout(() => {
    if (state.isDirty && state.currentFile) {
        saveFile();
    }
}, 2000); // Change 2000 to desired milliseconds
```

## Credits

This application uses the following open-source projects:

- [Marked](https://github.com/markedjs/marked) - A markdown parser and compiler
- [Highlight.js](https://github.com/highlightjs/highlight.js) - Syntax highlighting for code blocks

## License

This is a custom-built application. Feel free to modify it for your personal use.

## Support

For issues or questions, check the console (F12) for error messages and verify:
- PHP is working correctly
- File permissions are set properly
- Web server configuration is correct
