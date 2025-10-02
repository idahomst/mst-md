# GitHub Markdown Examples

This document showcases various GitHub-flavored Markdown features.

## Headers

# H1 Header
## H2 Header
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header

## Text Formatting

**Bold text** or __bold text__

*Italic text* or _italic text_

***Bold and italic*** or ___bold and italic___

~~Strikethrough text~~

## Lists

### Unordered List
- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
- Item 3

### Ordered List
1. First item
2. Second item
3. Third item
   1. Nested item 3.1
   2. Nested item 3.2

### Task List
- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task

## Links and Images

[Link text](https://github.com)

[Link with title](https://github.com "GitHub Homepage")

![Alt text for image](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png)

## Code

### Inline Code
Use `inline code` within text.

### Code Blocks

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

```python
def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b

result = calculate_sum(5, 3)
print(f"The sum is: {result}")
```

```bash
#!/bin/bash
echo "Hello from bash"
for i in {1..5}; do
  echo "Count: $i"
done
```

```json
{
  "name": "example",
  "version": "1.0.0",
  "description": "A JSON example",
  "keywords": ["markdown", "example"]
}
```

## Blockquotes

> This is a blockquote.
>
> It can span multiple lines.

> Blockquotes can be nested
>> Like this

## Tables

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1 Col 1 | Row 1 Col 2 | Row 1 Col 3 |
| Row 2 Col 1 | Row 2 Col 2 | Row 2 Col 3 |
| Row 3 Col 1 | Row 3 Col 2 | Row 3 Col 3 |

### Aligned Tables

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left | Center | Right |
| Text | Text | Text |

## Horizontal Rules

---

***

___

## Escape Characters

Use backslash to escape: \* \_ \# \[ \]

## Syntax Highlighting Examples

### HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>Page Title</title>
</head>
<body>
  <h1>My First Heading</h1>
  <p>My first paragraph.</p>
</body>
</html>
```

### CSS
```css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f0f0;
}

#header {
  font-size: 24px;
  color: #333;
}
```

### SQL
```sql
SELECT users.name, orders.order_date, orders.total
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE orders.total > 100
ORDER BY orders.order_date DESC;
```

### Rust
```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];

    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
```

## Collapsible Sections

<details>
<summary>Click to expand</summary>

Hidden content goes here!

```javascript
console.log("This code is hidden by default");
```
</details>
