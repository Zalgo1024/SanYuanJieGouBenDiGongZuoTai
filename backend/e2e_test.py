"""端到端闭环自检脚本。"""
import json
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def req(method, path, body=None):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        return e.code, (json.loads(raw) if raw else None)


# 1. 建 project
st, proj = req("POST", "/api/projects", {"title": "端到端测试报告", "type": "case", "tone": "neutral"})
print(f"[1] POST /api/projects -> {st}")
print(f"    project: id={proj['id']} title={proj['title']} status={proj['status']}")
pid = proj["id"]

# 2. 加一条素材
st, mat = req("POST", f"/api/projects/{pid}/materials", {"name": "示例来源", "url": "https://example.com"})
print(f"[2] POST /api/projects/{pid}/materials -> {st}")
print(f"    material: id={mat['id']} name={mat['name']}")

# 3. 列素材
st, mats = req("GET", f"/api/projects/{pid}/materials")
print(f"[3] GET  /api/projects/{pid}/materials -> {st} count={len(mats)}")

# 4. POST generate — 极简 Markdown
body_md = "## 情况概述\n测试正文，最小闭环。\n\n## 附录\n- [示例来源](https://example.com)"
st, gen = req("POST", f"/api/projects/{pid}/generate",
              {"title": "端到端测试报告", "markdown": body_md, "tone": "neutral"})
print(f"[4] POST /api/projects/{pid}/generate -> {st}")
print(f"    generate: run_id={gen['run_id']} status={gen['status']}")
rid = gen["run_id"]

# 5. 轮询 run 到 success/failed
deadline = time.time() + 90
final = None
while time.time() < deadline:
    st, run = req("GET", f"/api/runs/{rid}")
    status = run["status"]
    log_tail = run["log"][-1] if run["log"] else "(no log yet)"
    print(f"[5] GET /api/runs/{rid} -> status={status} log_tail={log_tail!r}")
    if status in ("success", "failed"):
        final = run
        break
    time.sleep(2)

if not final:
    print("!! 超时：run 未在 90s 内完成")
    raise SystemExit(1)

if final["status"] != "success":
    print(f"!! run 失败：error={final.get('error')}")
    print("full log:")
    for l in final["log"]:
        print("  ", l)
    raise SystemExit(1)

rep_id = final["report_id"]
print(f"    run success: report_id={rep_id}")

# 6. GET report
st, rep = req("GET", f"/api/reports/{rep_id}")
print(f"[6] GET /api/reports/{rep_id} -> {st}")
print(f"    title={rep['title']} pdf_ok={rep['pdf_ok']} sections={len(rep['sections'])}")
print(f"    artifacts: docx_url={rep['artifacts'].get('docx_url')} pdf_url={rep['artifacts'].get('pdf_url')} png_urls={rep['artifacts'].get('png_urls')}")
print(f"    cover_graph_url={rep.get('cover_graph_url')}")
print("    sections:")
for s in rep["sections"]:
    print(f"      order={s['order']} cid={s['cid']!r} title={s['title']!r} blocks={len(s['blocks'])}")

# 7. GET graphs
st, graphs = req("GET", f"/api/reports/{rep_id}/graphs")
print(f"[7] GET /api/reports/{rep_id}/graphs -> {st}")
print(f"    network={graphs['network']} org={graphs['org']} flow={graphs['flow']}")

# 8. GET project (verify status=generated + runs listed)
st, proj2 = req("GET", f"/api/projects/{pid}")
print(f"[8] GET /api/projects/{pid} -> {st} status={proj2['status']} runs={len(proj2['runs'])}")

# 9. 文件下载（docx） — 现在 artifacts URL 已是绝对地址
if rep["artifacts"].get("docx_url"):
    import urllib.parse
    docx_url = rep["artifacts"]["docx_url"]
    # 中文文件名需 URL-encode（浏览器自动处理，urllib 要手动）
    # docx_url 已是绝对地址，只对 path 部分编码
    from urllib.parse import urlsplit, urlunsplit
    parts = urlsplit(docx_url)
    encoded_path = urllib.parse.quote(parts.path, safe="/")
    full_url = urlunsplit((parts.scheme, parts.netloc, encoded_path, parts.query, parts.fragment))
    r = urllib.request.urlopen(full_url)
    body = r.read()
    print(f"[9] GET {docx_url} -> HTTP {r.status} bytes={len(body)} (docx binary)")

print("\n=== IS_PASS: YES ===")
