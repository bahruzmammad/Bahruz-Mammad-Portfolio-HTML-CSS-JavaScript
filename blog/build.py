#!/usr/bin/env python3

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
CONTENT_DIR = ROOT_DIR / "content"
OUTPUT_DIR = ROOT_DIR

SITE_NAME = "Bahruz Mammadov Blog"
SITE_AUTHOR = "Bahruz Mammadov"
SITE_URL = "https://blog.bahruzmammad.github.io"

# FRONTMATTER_RE = re.compile(
#     r"\A---[ \t]*\r?\n(?P<meta>.*?)\r?\n---[ \t]*\r?\n?(?P<body>[\s\S]*)\Z"
# )

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
LIST_RE = re.compile(r"^[-*]\s+(.+)$")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
INLINE_CODE_RE = re.compile(r"`([^`]+)`")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")


class BuildError(Exception):
    """Raised when the blog build cannot be completed safely."""


@dataclass(frozen=True, slots=True)
class Post:
    title: str
    description: str
    published: date
    tags: tuple[str, ...]
    slug: str
    body: str
    source: Path

    @property
    def reading_time(self) -> int:
        words = re.findall(r"\b[\w'-]+\b", self.body)
        return max(1, (len(words) + 199) // 200)


def log(message: str) -> None:
    print(f"[build] {message}")


def error(message: str) -> None:
    raise BuildError(message)


def slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")

    if not slug:
        error(f"Cannot create slug from title: {value!r}")

    return slug


def parse_scalar(value: str) -> str:
    value = value.strip()

    if len(value) >= 2 and value[0] == value[-1]:
        if value[0] in {"'", '"'}:
            return value[1:-1]

    return value


def parse_frontmatter(source: Path) -> tuple[dict[str, object], str]:
    try:
        content = source.read_text(encoding="utf-8")
    except OSError as exc:
        raise BuildError(f"Cannot read {source}: {exc}") from exc

    lines = content.splitlines()

    if not lines or lines[0].strip() != "---":
        error(f"{source}: invalid front matter. File must start with ---.")

    closing_index = None

    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            closing_index = index
            break

    if closing_index is None:
        error(f"{source}: invalid front matter. Closing --- marker not found.")

    metadata: dict[str, object] = {}
    tags: list[str] = []
    reading_tags = False

    for raw_line in lines[1:closing_index]:
        line = raw_line.strip()

        if not line:
            continue

        if line == "tags:":
            reading_tags = True
            continue

        if reading_tags:
            if line.startswith("- "):
                tag = parse_scalar(line[2:])
                if tag:
                    tags.append(tag)
                continue

            reading_tags = False

        if ":" not in line:
            error(f"{source}: invalid metadata line: {raw_line!r}")

        key, value = line.split(":", 1)
        key = key.strip()

        if not key:
            error(f"{source}: metadata key cannot be empty")

        metadata[key] = parse_scalar(value)

    metadata["tags"] = tags

    body = "\n".join(lines[closing_index + 1 :]).strip()

    return metadata, body


def validate_post(
    source: Path,
    metadata: dict[str, object],
    body: str,
) -> Post:
    required = ("title", "description", "date")

    for field in required:
        value = metadata.get(field)

        if not isinstance(value, str) or not value.strip():
            error(f"{source}: missing required field '{field}'")

    title = str(metadata["title"]).strip()
    description = str(metadata["description"]).strip()
    date_value = str(metadata["date"]).strip()
    tags_value = metadata.get("tags", [])
    slug_value = str(metadata.get("slug", "")).strip()
    slug = slugify(slug_value) if slug_value else slugify(title)

    try:
        published = date.fromisoformat(date_value)
    except ValueError as exc:
        raise BuildError(
            f"{source}: invalid date '{date_value}'. Expected YYYY-MM-DD."
        ) from exc

    if not body:
        error(f"{source}: article body cannot be empty")

    if not isinstance(tags_value, list):
        error(f"{source}: tags must be a YAML-style list")

    tags = tuple(str(tag).strip() for tag in tags_value if str(tag).strip())

    return Post(
        title=title,
        description=description,
        published=published,
        tags=tags,
        slug=slug,
        body=body,
        source=source,
    )


def load_posts() -> list[Post]:
    if not CONTENT_DIR.exists():
        error(f"Content directory does not exist: {CONTENT_DIR}")

    sources = sorted(
        source for source in CONTENT_DIR.glob("*/*.md") if source.is_file()
    )

    if not sources:
        error(f"No Markdown files found in {CONTENT_DIR}")

    posts: list[Post] = []

    for source in sources:
        metadata, body = parse_frontmatter(source)
        posts.append(validate_post(source, metadata, body))

    slugs: set[str] = set()

    for post in posts:
        if post.slug in slugs:
            error(f"Duplicate slug detected: {post.slug}")

        slugs.add(post.slug)

    posts.sort(
        key=lambda post: (
            post.published,
            post.title.lower(),
        ),
        reverse=True,
    )

    return posts


def render_inline(text: str) -> str:
    result = html.escape(text, quote=True)

    result = IMAGE_RE.sub(
        lambda match: (
            f'<img src="{html.escape(match.group(2), quote=True)}" '
            f'alt="{html.escape(match.group(1), quote=True)}" '
            'loading="lazy">'
        ),
        result,
    )

    result = LINK_RE.sub(
        lambda match: (
            f'<a href="{html.escape(match.group(2), quote=True)}" '
            'target="_blank" '
            'rel="noopener noreferrer">'
            f"{match.group(1)}</a>"
        ),
        result,
    )

    result = INLINE_CODE_RE.sub(
        r"<code>\1</code>",
        result,
    )

    result = BOLD_RE.sub(
        r"<strong>\1</strong>",
        result,
    )

    result = ITALIC_RE.sub(
        r"<em>\1</em>",
        result,
    )

    return result


def render_markdown(markdown: str) -> str:
    lines = markdown.splitlines()
    output: list[str] = []

    paragraph: list[str] = []
    list_items: list[str] = []
    code_lines: list[str] = []

    in_code = False
    code_language = ""

    def flush_paragraph() -> None:
        if not paragraph:
            return

        text = " ".join(line.strip() for line in paragraph)

        output.append(f"<p>{render_inline(text)}</p>")

        paragraph.clear()

    def flush_list() -> None:
        if not list_items:
            return

        items = "".join(f"<li>{render_inline(item)}</li>" for item in list_items)

        output.append(f"<ul>{items}</ul>")
        list_items.clear()

    def flush_code() -> None:
        nonlocal in_code, code_language

        if not in_code:
            return

        code = html.escape(
            "\n".join(code_lines),
            quote=False,
        )

        language = (
            f' class="language-{html.escape(code_language)}"' if code_language else ""
        )

        output.append(f"<pre><code{language}>{code}</code></pre>")

        code_lines.clear()
        code_language = ""
        in_code = False

    for line in lines:
        if line.startswith("```"):
            if in_code:
                flush_code()
            else:
                flush_paragraph()
                flush_list()

                in_code = True
                code_language = line[3:].strip()

            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line.strip():
            flush_paragraph()
            flush_list()
            continue

        heading = HEADING_RE.match(line)

        if heading:
            flush_paragraph()
            flush_list()

            level = len(heading.group(1))
            text = render_inline(heading.group(2).strip())

            output.append(f"<h{level}>{text}</h{level}>")

            continue

        list_match = LIST_RE.match(line)

        if list_match:
            flush_paragraph()
            list_items.append(list_match.group(1).strip())
            continue

        flush_list()
        paragraph.append(line)

    flush_code()
    flush_paragraph()
    flush_list()

    return "\n".join(output)


def render_head(
    title: str,
    description: str,
    stylesheet: str,
    canonical_url: str,
) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <meta
        name="description"
        content="{html.escape(description, quote=True)}"
    >
    <meta
        name="author"
        content="{html.escape(SITE_AUTHOR, quote=True)}"
    >
    <meta
        name="robots"
        content="index, follow"
    >
    <link
        rel="canonical"
        href="{html.escape(canonical_url, quote=True)}"
    >
    <meta
        property="og:title"
        content="{html.escape(title, quote=True)}"
    >
    <meta
        property="og:description"
        content="{html.escape(description, quote=True)}"
    >
    <meta
        property="og:type"
        content="article"
    >
    <meta
        property="og:url"
        content="{html.escape(canonical_url, quote=True)}"
    >
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": {json.dumps(title)},
        "description": {json.dumps(description)},
        "author": {{
            "@type": "Person",
            "name": {json.dumps(SITE_AUTHOR)}
        }},
        "url": {json.dumps(canonical_url)}
    }}
    </script>
    <title>
        {html.escape(title)} | {html.escape(SITE_NAME)}
    </title>
    <link
        rel="stylesheet"
        href="{stylesheet}"
    >
</head>
"""


def render_post(post: Post) -> str:
    content = render_markdown(post.body)

    tags = "".join(f"<li>{html.escape(tag)}</li>" for tag in post.tags)

    return f"""{
        render_head(
            post.title,
            post.description,
            "../assets/css/blog.css",
            f"{SITE_URL}/{post.slug}/",
        )
    }
<body>
<main class="blog-container">
    <article class="post">
        <header class="post-header">
            <a href="../">
                ← Back to blog
            </a>

            <p class="post-meta">
                {post.published.strftime("%B %d, %Y")}
                ·
                {post.reading_time} min read
            </p>

            <h1>
                {html.escape(post.title)}
            </h1>

            <p class="post-description">
                {html.escape(post.description)}
            </p>

            <ul class="post-tags">
                {tags}
            </ul>
        </header>

        <div class="post-content">
            {content}
        </div>
    </article>
</main>
</body>
</html>
"""


def render_index(posts: list[Post]) -> str:
    cards: list[str] = []

    for post in posts:
        tags = "".join(f"<span>{html.escape(tag)}</span>" for tag in post.tags)

        cards.append(
            f"""<article class="post-card">
    <p class="post-meta">
        {post.published.strftime("%B %d, %Y")}
        ·
        {post.reading_time} min read
    </p>

    <h2>
        <a href="{post.slug}/">
            {html.escape(post.title)}
        </a>
    </h2>

    <p>
        {html.escape(post.description)}
    </p>

    <div class="post-tags">
        {tags}
    </div>
</article>"""
        )

    cards_html = "\n".join(cards)

    return f"""{
        render_head(
            SITE_NAME,
            "Articles about software engineering and programming.",
            "assets/css/blog.css",
            f"{SITE_URL}/",
        )
    }
<body>
<main class="blog-container">
    <header class="blog-header">
        <p class="blog-label">Blog</p>

        <h1>
            {html.escape(SITE_NAME)}
        </h1>

        <p>
            Notes on software engineering,
            backend development, and programming.
        </p>
    </header>

    <section
        class="posts"
        aria-label="Blog posts"
    >
        {cards_html}
    </section>
</main>
</body>
</html>
"""


def write_file(path: Path, content: str) -> None:
    try:
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        temporary = path.with_suffix(path.suffix + ".tmp")

        temporary.write_text(
            content,
            encoding="utf-8",
        )

        temporary.replace(path)

    except OSError as exc:
        raise BuildError(f"Cannot write {path}: {exc}") from exc


def render_sitemap(posts: list[Post]) -> str:
    urls = [f"{SITE_URL}/"]
    urls.extend(f"{SITE_URL}/{post.slug}/" for post in posts)
    items = "\n".join(
        f"    <url>\n        <loc>{html.escape(url)}</loc>\n    </url>" for url in urls
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{items}
</urlset>
"""


def render_feed(posts: list[Post]) -> str:
    items = "\n".join(
        f"    <item>\n        <title>{html.escape(post.title)}</title>\n        <link>{SITE_URL}/{post.slug}/</link>\n        <guid>{SITE_URL}/{post.slug}/</guid>\n        <description>{html.escape(post.description)}</description>\n    </item>"
        for post in posts
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
    <title>Blog</title>
    <link>{SITE_URL}/</link>
    <description>Portfolio Blog</description>
{items}
</channel>
</rss>
"""


def build(posts: list[Post]) -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    for post in posts:
        output = OUTPUT_DIR / post.slug / "index.html"
        output.parent.mkdir(parents=True, exist_ok=True)

        source_assets = post.source.parent / "assets"
        output_assets = output.parent / "assets"

        if source_assets.is_dir():
            import shutil

            shutil.copytree(source_assets, output_assets, dirs_exist_ok=True)

        write_file(
            output,
            render_post(post),
        )

        log(f"generated {output.relative_to(ROOT_DIR)}")

    write_file(
        ROOT_DIR / "index.html",
        render_index(posts),
    )
    write_file(
        ROOT_DIR / "sitemap.xml",
        render_sitemap(posts),
    )
    write_file(
        ROOT_DIR / "feed.xml",
        render_feed(posts),
    )

    log("generated blog/index.html")


def main() -> int:
    try:
        log("starting build")

        posts = load_posts()

        log(f"validated {len(posts)} post(s)")

        build(posts)

        log("build completed successfully")

        return 0

    except BuildError as exc:
        print(
            f"[error] {exc}",
            file=sys.stderr,
        )
        return 1

    except KeyboardInterrupt:
        print(
            "[error] build interrupted",
            file=sys.stderr,
        )
        return 130

    except Exception as exc:
        print(
            f"[error] unexpected failure: {type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
