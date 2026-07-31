import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand / structural (from Ardot canvas)
        navy: {
          DEFAULT: "#1B3A5C",
          50: "#EAF0F6",
          600: "#1B3A5C",
          700: "#16304A",
        },
        logo: "#FFB300",
        navtext: "#AEBFD0",
        avatar: "#4F81BD",
        pagebg: "#F4F5F7",
        cardborder: "#E5E7EB",
        inputbg: "#F9FAFB",
        track: "#EEF0F2",
        // Text
        ink: "#1A1A2E",
        sub: "#6B7280",
        muted: "#9CA3AF",
        // Accent
        accent: "#F49C12",
        // Six interest categories
        interest: {
          material: "#E74C3C", // 物质利益 红
          safety: "#F49C12",   // 安全利益 橙
          political: "#2E86C1",// 政治利益 蓝
          identity: "#8E44AD", // 身份文化 紫
          future: "#1ABC9C",   // 制度性未来 青
          public: "#27AE60",   // 公共利益 绿
        },
        // Status
        okbg: "#E8F5E9",
        okfg: "#2E7D32",
        runbg: "#FFF3E0",
        runfg: "#E65100",
        toggleon: "#16A34A",
        toggleoff: "#D1D5DB",
      },
      borderRadius: {
        card: "12px",
        lg2: "16px",
        input: "8px",
        pill: "4px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.05)",
      },
      fontFamily: {
        sans: [
          "Noto Sans SC",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "13": ["13px", { lineHeight: "1.4" }],
      },
      spacing: {
        sidebar: "240px",
        projsidebar: "200px",
        topbar: "56px",
        content: "968px",
      },
      maxWidth: {
        shell: "1920px",
      },
    },
  },
  plugins: [],
};

export default config;
