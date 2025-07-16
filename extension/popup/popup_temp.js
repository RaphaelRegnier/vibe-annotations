  renderAnnotationItem(annotation) {
    const truncatedComment = annotation.comment.length > 100 
      ? annotation.comment.substring(0, 100) + '...'
      : annotation.comment;

    const timeAgo = this.getTimeAgo(annotation.created_at);

    return `
      <div class="annotation-item" data-id="${annotation.id}">
        <div class="annotation-header">
          <div class="annotation-status status-${annotation.status}">
            <div class="status-dot"></div>
            <span>${annotation.status}</span>
          </div>
        </div>
        <div class="annotation-comment">${this.escapeHtml(truncatedComment)}</div>
        <div class="annotation-meta">
          <span class="annotation-timestamp">${timeAgo}</span>
          <div class="annotation-actions">
            <button class="action-btn edit-btn" data-id="${annotation.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path>
              </svg>
            </button>
            <button class="action-btn delete-btn" data-id="${annotation.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }