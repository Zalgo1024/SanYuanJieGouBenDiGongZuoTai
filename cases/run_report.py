"""
案例脚本模板 — 新建案例时复制此文件。
放在 cases/ 目录中运行。

用法:
    1. 复制此文件为 cases/run_案例名.py
    2. 修改 TITLE 和 BODY 为实际分析内容
    3. 在项目根目录运行: python -m cases.run_案例名
    或: cd cases && python run_案例名.py

输出:
    reports/案例名_YYYYMMDD_HHMMSS/
        ├── 案例名.docx
        ├── 案例名.pdf
        └── 图N_网络图标题.png/.html
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from engine import CaseAnalysisEngine

# ============================================================
# 配置区：修改以下两个变量
# ============================================================

TITLE = "案例名称：副标题"

# 使用 Markdown 格式编写分析正文
# 六部分结构：案例事实摘要 → 分析框架说明 → 分析正文 → 结论 → 附录
BODY = r"""
## 一、案例事实摘要

纯事实描述，不加分析。

**时间线**：
- 2024年X月 — 事件A
- 2024年Y月 — 事件B

> 关键事实引用。

## 二、分析框架说明

> 核心张力：一句话写出最说不通的地方。

**核心命题：一句话核心判断。**

| 观察到的模式 | 选用的概念 | 概念如何解释 | 分析问题 |
|---|---|---|---|
| 事实描述 | 概念名 | 为什么选这个 | 要回答什么 |

```DIAGRAM
{"viz": "network", "title": "全景利益关系图",
 "nodes": [
   {"id":"A","label":"主体A","type":"actor"},
   {"id":"B","label":"主体B","type":"actor"},
   {"id":"C","label":"主体C","type":"actor"}
 ],
 "edges": [
   {"source":"A","target":"B","label":"关系","type":"economic"},
   {"source":"B","target":"C","label":"其他","type":"power"}
 ]}
```

## 三、三元结构分析正文

### 1. 第一节：冲突式标题（主体A视角）

事实层描述...

> 概念解释层...

→ 子结论句

```DIAGRAM
{"viz": "network", "title": "主体A的利益关系",
 "focus": "A",
 "nodes": [
   {"id":"A","label":"主体A","type":"actor"},
   {"id":"B","label":"主体B","type":"actor"}
 ],
 "edges": [
   {"source":"A","target":"B","label":"关系","type":"economic"}
 ]}
```

### 2. 第二节：冲突式标题（主体B视角）

...

```DIAGRAM
{"viz": "network", "title": "主体B的利益关系",
 "focus": "B",
 "nodes": [
   {"id":"B","label":"主体B","type":"actor"},
   {"id":"A","label":"主体A","type":"actor"},
   {"id":"C","label":"主体C","type":"actor"}
 ],
 "edges": [
   {"source":"A","target":"B","label":"关系","type":"economic"},
   {"source":"B","target":"C","label":"影响","type":"power"}
 ]}
```

## 四、结论

**汇流段**：...

**核心判断**：...

> 可传播金句。

## 五、附录

数据来源。可在附录使用超链接：[来源名称](https://example.com)

分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，国作登字-2026-A-00048134
r"""

# ============================================================
# 执行区：无需修改
# ============================================================

if __name__ == "__main__":
    engine = CaseAnalysisEngine()
    result = engine.export_from_text(TITLE, BODY, overwrite=True)

    print("=" * 60)
    print(f"报告生成完成！")
    print(f"📄 Word:  {result['word']}")
    print(f"📕 PDF:   {result['pdf']}" if result['pdf'] else "📕 PDF:   未生成（请安装 LibreOffice 或 pandoc）")
    print(f"📁 目录:   {result['folder']}")
    diagrams = result.get("diagrams", [])
    if diagrams:
        print(f"📊 网络图 ({len(diagrams)} 张):")
        for d in diagrams:
            print(f"      {d['title']}: {d['png']}")
    else:
        print(f"📊 网络图: 无")
    print("=" * 60)
