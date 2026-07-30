"""自动编号工具：给 Markdown 标题加序列号。

H2 → 一、二、三、... （中文，全文递增）
H3 → 1. 2. 3. ...（阿拉伯，每 H2 段落重置）

用法：
    from auto_number import auto_number_headings
    numbered = auto_number_headings(raw_body)
"""

import re

CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
          "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"]


def _is_numbered(heading_text: str) -> bool:
    """判断标题是否已有编号前缀。"""
    # H2: 一、 二、 三、 ...
    if re.match(r'^[一二三四五六七八九十]+、', heading_text):
        return True
    # H2: 1. 2. 等异常情况（极少）
    if re.match(r'^\d+[\.\、]\s*', heading_text):
        return True
    # H3: 1. 2. 3. ...
    if re.match(r'^\d+[\.\、]\s*', heading_text):
        return True
    # H3: （一）（二）等
    if re.match(r'^[（\(][一二三四五六七八九十]+[）\)]', heading_text):
        return True
    return False


def auto_number_headings(body: str) -> str:
    """给正文中未编号的 H2 / H3 标题加上序列号。

    已编号的标题跳过，不重复编号。
    """
    lines = body.split("\n")
    result: list[str] = []
    h2_counter = 0
    h3_counter = 0
    in_h2 = False

    for line in lines:
        stripped = line.strip()

        # ── H2（二级标题） ──
        if stripped.startswith("## ") and not stripped.startswith("### "):
            text = re.sub(r"^##\s*", "", stripped)
            h2_counter += 1
            h3_counter = 0
            in_h2 = True
            if not _is_numbered(text) and h2_counter <= len(CN_NUM):
                prefix = CN_NUM[h2_counter]
                # 保持原始缩进（空格）
                indent = line[:len(line) - len(line.lstrip())]
                result.append(f"{indent}## {prefix}、{text}")
            else:
                result.append(line)
            continue

        # ── H3（三级标题） ──
        if stripped.startswith("### "):
            in_h2 = True  # 即使前面没 H2 也计数
            text = re.sub(r"^###\s*", "", stripped)
            h3_counter += 1
            if not _is_numbered(text):
                indent = line[:len(line) - len(line.lstrip())]
                result.append(f"{indent}### {h3_counter}. {text}")
            else:
                result.append(line)
            continue

        # 非标题行 → 原样保留
        # 遇到空行分隔的段落（非标题），如果之前是 H2 段，H3 计数器保持
        if stripped == "":
            pass
        result.append(line)

    return "\n".join(result)
