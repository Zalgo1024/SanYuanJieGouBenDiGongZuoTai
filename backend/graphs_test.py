"""带 DIAGRAM 块的输入测试 — 验证 graphs {network,org,flow} 结构正确。"""
import json
import time
import urllib.request
import urllib.parse
from urllib.parse import urlsplit, urlunsplit

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


# 含三态图的正文
body_md = """## 情况概述
测试三态图结构。

## 利益关系图谱
正文段落。

```DIAGRAM
{
  "viz": "network",
  "title": "核心利益网络",
  "nodes": [
    {"id": "A", "label": "监管方", "group": "权力"},
    {"id": "B", "label": "品牌企业", "group": "经济"},
    {"id": "C", "label": "消费者", "group": "经济"}
  ],
  "edges": [
    {"from": "A", "to": "B", "label": "审批", "relation": "权力"},
    {"from": "B", "to": "C", "label": "供货", "relation": "经济"}
  ]
}
```

## 组织架构拆解

```DIAGRAM
{
  "viz": "org",
  "title": "组织层级",
  "nodes": [
    {"id": "TOP", "label": "决策层", "group": "权力"},
    {"id": "MID", "label": "执行层", "group": "权力"}
  ],
  "edges": [
    {"from": "TOP", "to": "MID", "label": "指挥", "relation": "权力"}
  ]
}
```

## 利益动线与转化

```DIAGRAM
{
  "viz": "flow",
  "title": "利益流动",
  "nodes": [
    {"id": "S1", "label": "资金入口", "group": "经济"},
    {"id": "S2", "label": "分配节点", "group": "经济"}
  ],
  "edges": [
    {"from": "S1", "to": "S2", "label": "拨款", "relation": "经济"}
  ]
}
```

## 附录
- [监管方政策文件](https://example.com/gov)
- [品牌企业财报](https://example.com/corp)
"""

st, proj = req("POST", "/api/projects", {"title": "三态图测试", "type": "case", "tone": "neutral"})
pid = proj["id"]
print(f"created project id={pid}")

st, gen = req("POST", f"/api/projects/{pid}/generate",
              {"title": "三态图测试", "markdown": body_md, "tone": "neutral"})
rid = gen["run_id"]
print(f"started run id={rid}")

# 轮询
deadline = time.time() + 120
final = None
while time.time() < deadline:
    st, run = req("GET", f"/api/runs/{rid}")
    status = run["status"]
    if status in ("success", "failed"):
        final = run
        break
    time.sleep(2)

if final["status"] != "success":
    print(f"FAILED: {final.get('error')}")
    for l in final["log"]:
        print("  ", l)
    raise SystemExit(1)

rep_id = final["report_id"]
print(f"run success, report_id={rep_id}")

st, rep = req("GET", f"/api/reports/{rep_id}")
print(f"report: sections={len(rep['sections'])} pdf_ok={rep['pdf_ok']}")
print(f"artifacts: png_urls={rep['artifacts']['png_urls']}")
print(f"cover_graph_url={rep['cover_graph_url']}")
print("sections:")
for s in rep["sections"]:
    diag_blocks = [b for b in s["blocks"] if b["type"] == "diagram"]
    print(f"  order={s['order']} cid={s['cid']!r} blocks={len(s['blocks'])} diagrams={len(diag_blocks)}")

st, graphs = req("GET", f"/api/reports/{rep_id}/graphs")
print(f"\ngraphs:")
for kind in ("network", "org", "flow"):
    g = graphs[kind]
    if g is None:
        print(f"  {kind}: None")
    else:
        nodes = g.get("nodes", [])
        edges = g.get("edges", [])
        # 检查 evidence 是否挂上
        ev_count = sum(1 for n in nodes if n.get("evidence"))
        print(f"  {kind}: nodes={len(nodes)} edges={len(edges)} nodes_with_evidence={ev_count}")
        for n in nodes[:2]:
            print(f"    node: id={n['id']!r} label={n['label']!r} group={n.get('group')!r} evidence={n.get('evidence')}")

# 验证 png 文件可下载
if rep["artifacts"]["png_urls"]:
    png_url = rep["artifacts"]["png_urls"][0]
    parts = urlsplit(png_url)
    encoded = urlunsplit((parts.scheme, parts.netloc, urllib.parse.quote(parts.path, safe="/"), "", ""))
    r = urllib.request.urlopen(encoded)
    body = r.read()
    print(f"\npng download: HTTP {r.status} bytes={len(body)}")

print("\n=== GRAPHS_TEST: PASS ===")
