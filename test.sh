#!/usr/bin/env fish

set -l failed 0

function pass
    echo "[PASS] $argv"
end

function fail
    echo "[FAIL] $argv"
    set -g failed 1
end

echo ""
echo "========================================"
echo " Portfolio + Blog Test Suite"
echo "========================================"
echo ""

echo "[1] Python syntax"

python3 -m py_compile blog/build.py

if test $status -eq 0
    pass "blog/build.py syntax"
else
    fail "blog/build.py syntax"
end


echo ""
echo "[2] Blog build"

python3 blog/build.py

if test $status -eq 0
    pass "blog build completed"
else
    fail "blog build failed"
end


echo ""
echo "[3] Portfolio files"

for file in index.html assets/css/styles.css assets/js/script.js
    if test -f $file
        pass $file
    else
        fail "$file missing"
    end
end


echo ""
echo "[4] Blog structure"

for path in blog/build.py blog/index.html blog/content
    if test -e $path
        pass $path
    else
        fail "$path missing"
    end
end


echo ""
echo "[5] Content structure"

for slug in hello hello-java

    if test -f blog/content/$slug/$slug.md
        pass "content/$slug/$slug.md"
    else
        fail "content/$slug/$slug.md missing"
    end

    for asset_dir in img code terminal video

        if test -d blog/content/$slug/assets/$asset_dir
            pass "content/$slug/assets/$asset_dir"
        else
            fail "content/$slug/assets/$asset_dir missing"
        end

    end
end


echo ""
echo "[6] Generated routes"

for slug in hello hello-java

    if test -f blog/$slug/index.html
        pass "/blog/$slug/"
    else
        fail "/blog/$slug/ missing"
    end

end


echo ""
echo "[7] Old routes must not exist"

for path in blog/posts blog/hello-world blog/java-main-method

    if test ! -e $path
        pass "$path removed"
    else
        fail "$path still exists"
    end

end


echo ""
echo "[8] Markdown front matter"

for slug in hello hello-java

    if rg -q '^title:' blog/content/$slug/$slug.md
        pass "$slug title"
    else
        fail "$slug title missing"
    end

    if rg -q '^description:' blog/content/$slug/$slug.md
        pass "$slug description"
    else
        fail "$slug description missing"
    end

    if rg -q '^date:' blog/content/$slug/$slug.md
        pass "$slug date"
    else
        fail "$slug date missing"
    end

    if rg -q '^slug:' blog/content/$slug/$slug.md
        pass "$slug slug"
    else
        fail "$slug slug missing"
    end

    if rg -q '^tags:' blog/content/$slug/$slug.md
        pass "$slug tags"
    else
        fail "$slug tags missing"
    end

end


echo ""
echo "[9] Markdown rendering"

if rg -q '<h1>Hello World</h1>' blog/hello/index.html
    pass "hello heading rendered"
else
    fail "hello heading not rendered"
end

if rg -q 'language-java' blog/hello-java/index.html
    pass "Java code block rendered"
else
    fail "Java code block not rendered"
end


echo ""
echo "[10] Source assets"

for asset in \
    blog/content/hello-java/assets/img/java-main-method.svg \
    blog/content/hello-java/assets/terminal/java-main-output.svg

    if test -f $asset
        pass $asset
    else
        fail "$asset missing"
    end

end


echo ""
echo "[11] Generated assets"

for asset in \
    blog/hello-java/assets/img/java-main-method.svg \
    blog/hello-java/assets/terminal/java-main-output.svg

    if test -f $asset
        pass $asset
    else
        fail "$asset missing from generated post"
    end

end


echo ""
echo "[12] Blog index"

if test -f blog/index.html
    pass "blog/index.html exists"
else
    fail "blog/index.html missing"
end

if rg -q 'hello' blog/index.html
    pass "hello post listed"
else
    fail "hello post not listed"
end

if rg -q 'hello-java' blog/index.html
    pass "hello-java post listed"
else
    fail "hello-java post not listed"
end


echo ""
echo "[13] SEO"

for file in blog/index.html blog/hello/index.html blog/hello-java/index.html

    if rg -q 'name="description"' $file
        pass "$file meta description"
    else
        fail "$file meta description missing"
    end

    if rg -q 'rel="canonical"' $file
        pass "$file canonical"
    else
        fail "$file canonical missing"
    end

    if rg -q 'property="og:title"' $file
        pass "$file Open Graph title"
    else
        fail "$file Open Graph title missing"
    end

    if rg -q 'property="og:description"' $file
        pass "$file Open Graph description"
    else
        fail "$file Open Graph description missing"
    end

    if rg -q 'application/ld\+json' $file
        pass "$file JSON-LD"
    else
        fail "$file JSON-LD missing"
    end

end


echo ""
echo "[14] Sitemap"

if test -f blog/sitemap.xml
    pass "blog/sitemap.xml"
else
    fail "blog/sitemap.xml missing"
end


echo ""
echo "[15] RSS feed"

if test -f blog/feed.xml
    pass "blog/feed.xml"
else
    fail "blog/feed.xml missing"
end


echo ""
echo "[16] Git validation"

git diff --check

if test $status -eq 0
    pass "git diff --check"
else
    fail "git diff --check"
end


echo ""
echo "========================================"

if test $failed -eq 0
    echo "ALL TESTS PASSED"
    echo "========================================"
    exit 0
else
    echo "TESTS FAILED"
    echo "========================================"
    exit 1
end
