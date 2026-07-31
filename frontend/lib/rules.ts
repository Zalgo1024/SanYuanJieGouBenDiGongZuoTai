// 铁律自检面板（T9）——13 条写作铁律（取自 KERNEL analysis_prompt.md「写作铁律速查」）。
// 静态 JSON + 机检函数；机检项实时算，人工项由用户勾选。
// 注意：本文件只做前端静态校验，不改写报告内容。

export interface RuleItem {
  id: string;
  title: string;
  desc: string;
  /** 是否可机检（true=自动计算，false=人工勾选）。 */
  machine: boolean;
  /** 机检通过提示（machine=true 时展示）。 */
  passText?: string;
}

export const RULES: RuleItem[] = [
  { id: "sections", title: "章节齐全", desc: "## 章节与所选类型骨架一致（不缺失、不乱序）", machine: true, passText: "章节齐全" },
  { id: "diagram", title: "DIAGRAM 合法", desc: "```DIAGRAM 块可被 json.loads 解析，nodes/edges 结构正确", machine: true, passText: "关系图合法" },
  { id: "appendix", title: "附录 [名称](url)", desc: "每条来源独立成行，格式 [来源完整名称](完整URL)，禁止裸 URL / 笼统来源", machine: true, passText: "附录格式正确" },
  { id: "dash", title: "破折号 ≤ 8", desc: "全文 `——` 总数 ≤ 8，标题不用 `——`", machine: true, passText: "破折号数量合规" },
  { id: "para", title: "段落 ≤ 5 行", desc: "正文段落不超过 5 行，避免大段堆砌", machine: true, passText: "段落长度合规" },
  { id: "cliche", title: "禁万能套话", desc: "不用「由此可见」「综上所述」「不难发现」「值得深思」「具有重要意义」「深远影响」「不可忽视」", machine: true, passText: "无套话" },
  { id: "concept", title: "概念 ≤ 3", desc: "可选概念池选用 ≤ 3 个（特殊 ≤ 4），概念是解读工具不是主角", machine: true, passText: "概念数合规" },
  { id: "fact", title: "禁编造", desc: "事实、数据、引语真实可溯源；不得虚构主体、夸大数字、捏造动机", machine: false },
  { id: "fact-driven", title: "事实驱动", desc: "每一句分析必须有具体事实支撑，不能从概念推导事实", machine: false },
  { id: "case-first", title: "案例先行", desc: "每节先呈现案例事实层，再引入概念解释层，自然融合", machine: false },
  { id: "bold", title: "粗体纪律", desc: "**粗体** 仅用于概念首次出现 / 结论标签行，禁止整段加粗、禁止在表格逐格加粗", machine: false },
  { id: "golden", title: "可传播金句", desc: "结论最后一句是能单独摘出来发朋友圈的判断", machine: false },
  { id: "loop", title: "结论呼应框架", desc: "框架说明提出的问题，结论必须给出对应判断", machine: false },
];

/** 套话黑名单（机检项）。 */
export const CLICHE_WORDS = [
  "由此可见",
  "综上所述",
  "不难发现",
  "值得深思",
  "具有重要意义",
  "深远影响",
  "不可忽视",
];

/** 概念计数：统计加粗文本中出现的中文概念词（2-6 字、非结论标签）。 */
const CONCEPT_BOLD_RE = /\*\*([^*\n]{2,6})\*\*/g;
const LABEL_LIKE = ["汇流段", "核心命题", "核心判断", "可传播金句", "冲突点", "子结论", "数据来源"];

/** 统计加粗中出现过的疑似概念（去重）。 */
function countConcepts(md: string): number {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  CONCEPT_BOLD_RE.lastIndex = 0;
  while ((m = CONCEPT_BOLD_RE.exec(md)) !== null) {
    const t = m[1].trim();
    if (!t || LABEL_LIKE.some((l) => t.includes(l))) continue;
    if (/[（(]|——|：/.test(t)) continue; // 排除带括号/破折号/冒号的标签行
    seen.add(t);
  }
  return seen.size;
}

/** 统计「——」出现次数。 */
function countDashes(md: string): number {
  return (md.match(/——/g) || []).length;
}

/** 统计正文中超过 5 行的段落数。 */
function countLongParagraphs(md: string): number {
  let n = 0;
  for (const block of md.split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("```") && !l.trim().startsWith("|") && !l.trim().startsWith(">"));
    if (lines.length > 5) n += 1;
  }
  return n;
}

/** 统计附录行中不符合 [名称](url) 的条目。 */
function countBadAppendixLines(md: string): number {
  // 附录区域：从「## 附录」或「**数据来源**」之后
  const idx = Math.max(md.indexOf("## 附录"), md.indexOf("**数据来源**"));
  if (idx < 0) return 0;
  const tail = md.slice(idx);
  let bad = 0;
  for (const line of tail.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^#{1,3}\s/.test(t)) continue; // 标题行
    if (/```/.test(t)) continue;
    // 允许序号开头：1. [名](url) / - [名](url) / 直接 [名](url)
    const core = t.replace(/^\s*(?:\d+[.、）)]|[-*•])\s*/, "");
    if (core.startsWith("[")) {
      if (!/^\[[^\]]+\]\((https?:\/\/[^)]+)\)/.test(core)) bad += 1;
    } else if (t.includes("http")) {
      bad += 1; // 裸 URL
    }
  }
  return bad;
}

export interface RuleCheckResult {
  id: string;
  pass: boolean;
  detail: string;
}

/** 机检全部可机检项。analysisType 用于章节齐全判断（case/policy/org/opinion/combo）。 */
export function checkRules(md: string, analysisType: string): RuleCheckResult[] {
  const out: RuleCheckResult[] = [];
  const text = md || "";

  // 1. 章节齐全（按类型骨架）
  const expected: Record<string, string[]> = {
    case: ["案例事实摘要", "利益主体识别", "利益动线与转化", "制度与叙事作用", "三元结构分析正文", "结论"],
    policy: ["独立事实摘要", "政策对象图谱", "政策权重与空间分析", "三元结构分析正文", "结论与推导"],
    org: ["组织画像", "架构拆解与资金来源", "生存诊断", "繁衍诊断", "利益关系网络与利益集团拆解", "逆反诊断", "利益转化与组织—社会关系", "诊断结论"],
    opinion: ["事件与时间线", "利益主体与沉默方", "叙事竞争矩阵", "三元生命维度", "逆反性质与层级", "演化曲线与系统回应", "结论"],
    combo: [],
  };
  const need = expected[analysisType] ?? expected.case;
  const headRe = /^##\s*[（(]?[一二三四五六七八九十百\d]+[）)、.．\s]*([^\n]+)/gm;
  const heads: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = headRe.exec(text)) !== null) heads.push(m[1].trim());
  const missing = need.filter((s) => !heads.some((h) => h.includes(s)));
  out.push({
    id: "sections",
    pass: missing.length === 0,
    detail: missing.length ? `缺章节：${missing.join("、")}` : "章节齐全",
  });

  // 2. DIAGRAM 合法
  const diagRe = /```DIAGRAM\s*\n([\s\S]*?)\n```/g;
  let diagOk = true;
  let diagCount = 0;
  let dm: RegExpExecArray | null;
  while ((dm = diagRe.exec(text)) !== null) {
    diagCount += 1;
    try {
      const obj = JSON.parse(dm[1].trim());
      if (!obj || !Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) diagOk = false;
    } catch {
      diagOk = false;
    }
  }
  out.push({
    id: "diagram",
    pass: diagOk && diagCount > 0,
    detail: diagCount === 0 ? "缺少 DIAGRAM 关系图" : diagOk ? `DIAGRAM 合法（${diagCount} 张）` : "DIAGRAM 存在非法 JSON",
  });

  // 3. 附录 [名称](url)
  const badAppendix = countBadAppendixLines(text);
  out.push({
    id: "appendix",
    pass: badAppendix === 0,
    detail: badAppendix ? `${badAppendix} 条来源不符合 [名称](url) 格式` : "附录格式正确",
  });

  // 4. 破折号 ≤ 8
  const dashes = countDashes(text);
  out.push({
    id: "dash",
    pass: dashes <= 8,
    detail: `—— ${dashes} 处${dashes > 8 ? "（超预算）" : ""}`,
  });

  // 5. 段落 ≤ 5 行
  const longParas = countLongParagraphs(text);
  out.push({
    id: "para",
    pass: longParas === 0,
    detail: longParas ? `${longParas} 段超过 5 行` : "段落长度合规",
  });

  // 6. 套话黑名单
  const hits = CLICHE_WORDS.filter((w) => text.includes(w));
  out.push({
    id: "cliche",
    pass: hits.length === 0,
    detail: hits.length ? `套话：${hits.join("、")}` : "无套话",
  });

  // 7. 概念 ≤ 3
  const concepts = countConcepts(text);
  out.push({
    id: "concept",
    pass: concepts <= 3,
    detail: `加粗疑似概念 ${concepts} 个${concepts > 3 ? "（超限）" : ""}`,
  });

  return out;
}
