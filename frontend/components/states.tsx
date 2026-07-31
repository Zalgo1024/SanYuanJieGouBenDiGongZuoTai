// 统一的状态展示组件：加载中 / 错误 / 空状态 / 提示（含权限说明）。
// 各处页面复用，保证交互语言一致，避免各页各自为政的占位/错误文案。
import Link from "next/link";

export function LoadingState({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted py-6">
      <span className="w-4 h-4 rounded-full border-2 border-track border-t-navy animate-spin" />
      {text}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card p-6 flex items-start gap-3 border-interest-material/40">
      <span className="text-interest-material text-[18px] leading-none mt-0.5">⚠</span>
      <div className="flex-1">
        <div className="text-[13px] text-[#C62828] font-medium">出错了</div>
        <div className="text-[13px] text-sub mt-1 leading-relaxed">{message}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-ghost h-8 px-3 text-[12px] mt-3"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <div className="text-[13px] text-muted">{title}</div>
      {hint && <div className="text-[12px] text-muted/80 mt-2 leading-relaxed max-w-[420px] mx-auto">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** 通用提示条：info（蓝）/ warn（琥珀）/ success（绿）。权限相关说明用 info 或 warn。 */
export function Notice({
  kind = "info",
  children,
  className = "",
}: {
  kind?: "info" | "warn" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const cls =
    kind === "warn"
      ? "bg-[#FFF8E1] border-[#F0D98C] text-[#8a6d1f]"
      : kind === "success"
      ? "bg-[#E8F5E9] border-[#A5D6A7] text-[#2E7D32]"
      : "bg-[#F0F4FA] border-navy/20 text-navy";
  return (
    <div className={`rounded-input border px-3 py-2.5 text-[12px] leading-relaxed ${cls} ${className}`}>
      {children}
    </div>
  );
}

/** 权限/访问说明（本地单用户模式下：无多用户隔离，所有数据归本机当前用户）。 */
export function PermissionNotice({ children }: { children?: React.ReactNode }) {
  return (
    <Notice kind="info">
      {children ?? (
        <>
          当前为<strong>本地单用户模式</strong>：数据仅保存在本机与本地后端，不区分多用户权限。
          多用户隔离与会员权限体系尚未启用。
        </>
      )}
    </Notice>
  );
}

/** 带链接的空状态（引导去某页）。 */
export function EmptyStateLink({
  title,
  hint,
  href,
  linkText,
}: {
  title: string;
  hint?: string;
  href: string;
  linkText: string;
}) {
  return (
    <EmptyState
      title={title}
      hint={hint}
      action={
        <Link href={href} className="btn-primary h-9 px-4 text-[13px]">
          {linkText}
        </Link>
      }
    />
  );
}
