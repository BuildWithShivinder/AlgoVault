/**
 * AlgoVault Toast Notification Component
 */
(function() {
  if (window.CodeSyncToast) return;

  function ensureContainer() {
    let container = document.getElementById('algovault-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'algovault-toast-container';
      container.className = 'codesync-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  window.CodeSyncToast = {
    show: function({ type = 'success', title = 'AlgoVault', message = '', commitUrl = null, duration = 6000 }) {
      const container = ensureContainer();

      const toast = document.createElement('div');
      toast.className = `codesync-toast codesync-toast-${type}`;

      let linkHtml = '';
      if (commitUrl) {
        linkHtml = `<a href="${commitUrl}" target="_blank" rel="noopener noreferrer" class="codesync-toast-link">View Commit in GitHub ↗</a>`;
      }

      toast.innerHTML = `
        <div class="codesync-toast-content">
          <div class="codesync-toast-title">
            <span>${title}</span>
            <button class="codesync-toast-close" aria-label="Close">&times;</button>
          </div>
          <div class="codesync-toast-subtitle">${message}</div>
          ${linkHtml}
        </div>
      `;

      const closeBtn = toast.querySelector('.codesync-toast-close');
      closeBtn.addEventListener('click', () => {
        toast.style.animation = 'codesync-slide-out 0.2s forwards';
        setTimeout(() => toast.remove(), 200);
      });

      container.appendChild(toast);

      if (duration > 0) {
        setTimeout(() => {
          if (toast.parentNode) {
            toast.style.animation = 'codesync-slide-out 0.2s forwards';
            setTimeout(() => toast.remove(), 200);
          }
        }, duration);
      }
    }
  };
})();
