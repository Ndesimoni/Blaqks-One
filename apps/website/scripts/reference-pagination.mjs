export function publicPagination(data) {
  if (data.site.sample || data.page !== 'agents' || !data.directory) return;
  const { page, pageSize, total } = data.directory;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const target = document.querySelector('#u-agent-pagination');
  const count = document.querySelector('#u-directory-count');
  if (count) count.textContent = total + ' public agents';
  if (!target) return;
  target.hidden = total === 0;
  target.innerHTML = `<span>Showing ${total ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, total)} of ${total} agents</span>
    <div><button data-public-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Previous</button>
    <button aria-current="page" disabled>${page}</button>
    <button data-public-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next →</button></div>`;
}
