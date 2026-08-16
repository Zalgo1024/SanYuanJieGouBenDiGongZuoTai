import pytest

from app.search import _assert_safe_url


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8000/health",
        "http://[::1]/health",
        "http://169.254.169.254/latest/meta-data/",
        "file:///C:/Windows/win.ini",
    ],
)
def test_search_rejects_local_and_non_http_urls(url):
    with pytest.raises(ValueError):
        _assert_safe_url(url)


def test_search_accepts_public_https_url():
    _assert_safe_url("https://example.com/report")
