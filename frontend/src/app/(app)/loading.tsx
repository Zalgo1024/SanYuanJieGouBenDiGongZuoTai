export default function ApplicationLoading() {
  return (
    <section className="route-state" aria-live="polite" aria-busy="true">
      <span className="route-state__spinner" aria-hidden="true" />
      <p>正在打开分析空间...</p>
    </section>
  );
}
