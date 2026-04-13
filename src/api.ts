import axios, { AxiosInstance } from 'axios';

const API_URLS = [
  window.location.origin + '/backend/api',        // Same domain (Hostinger/production)
  'http://localhost/backend/api',                  // Laragon default
  'http://localhost:80/backend/api',               // XAMPP default
  'http://127.0.0.1/backend/api',                 // Alternative localhost
];

let API_BASE_URL = '';
const SESSION_KEY = 'spts_session_token';
const BACKEND_MODE_KEY = 'spts_backend_mode';
const API_URL_KEY = 'spts_api_url';

// Try to use cached API URL first
const cachedUrl = localStorage.getItem(API_URL_KEY);
if (cachedUrl) {
  API_BASE_URL = cachedUrl;
}

let backendAvailable: boolean | null = null;

function getToken(): string {
  return localStorage.getItem(SESSION_KEY) || '';
}

function setToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isBackendMode(): boolean {
  return localStorage.getItem(BACKEND_MODE_KEY) === 'true';
}

// Create axios instance with current token
function createApi(): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': getToken(),
    },
  });
}

// ============================================
// CHECK BACKEND - Try multiple URLs
// ============================================
export async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;

  // If we have a cached URL, try it first
  if (cachedUrl) {
    try {
      const response = await axios.get(`${cachedUrl}/auth.php?action=session`, {
        timeout: 3000,
        headers: { 'X-Session-Token': 'test' },
        validateStatus: () => true,
      });
      if (response.status > 0 && response.data !== undefined) {
        backendAvailable = true;
        API_BASE_URL = cachedUrl;
        localStorage.setItem(BACKEND_MODE_KEY, 'true');
        console.log('✅ PHP Backend connected:', cachedUrl);
        return true;
      }
    } catch {
      // cached URL failed, try others
    }
  }

  // Try all possible URLs
  for (const url of API_URLS) {
    try {
      const response = await axios.get(`${url}/auth.php?action=session`, {
        timeout: 3000,
        headers: { 'X-Session-Token': 'test' },
        validateStatus: () => true,
      });
      // If we get ANY JSON response (even error), backend is running
      if (response.status > 0 && typeof response.data === 'object') {
        backendAvailable = true;
        API_BASE_URL = url;
        localStorage.setItem(BACKEND_MODE_KEY, 'true');
        localStorage.setItem(API_URL_KEY, url);
        console.log('✅ PHP Backend found at:', url);
        return true;
      }
    } catch {
      // This URL didn't work, try next
      continue;
    }
  }

  backendAvailable = false;
  localStorage.setItem(BACKEND_MODE_KEY, 'false');
  localStorage.removeItem(API_URL_KEY);
  console.log('⚠️ No PHP Backend found - using localStorage mode');
  return false;
}

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  async login(email: string, password: string) {
    const api = createApi();
    const res = await api.post('/auth.php?action=login', { email, password });
    if (res.data.success && res.data.token) {
      setToken(res.data.token);
    }
    return res.data;
  },

  async signup(name: string, email: string, password: string, role: string) {
    const api = createApi();
    const res = await api.post('/auth.php?action=signup', { name, email, password, role });
    return res.data;
  },

  async checkSession() {
    const token = getToken();
    if (!token || token === 'test') {
      return { success: false };
    }
    const api = createApi();
    const res = await api.get('/auth.php?action=session');
    return res.data;
  },

  async logout() {
    const api = createApi();
    try {
      await api.post('/auth.php?action=logout');
    } catch {
      // ignore
    }
    clearToken();
  },

  getToken,
  setToken,
  clearToken,
};

// ============================================
// PROJECTS API
// ============================================
export const projectsAPI = {
  async list() {
    const api = createApi();
    const res = await api.get('/projects.php?action=list');
    return res.data;
  },

  async get(id: string) {
    const api = createApi();
    const res = await api.get(`/projects.php?action=get&id=${id}`);
    return res.data;
  },

  async create(formData: FormData) {
    const token = getToken();
    const res = await axios.post(`${API_BASE_URL}/projects.php?action=create`, formData, {
      headers: {
        'X-Session-Token': token,
      },
      timeout: 60000,
    });
    return res.data;
  },

  async approve(projectId: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=approve', { projectId });
    return res.data;
  },

  async reject(projectId: string, reason?: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=reject', { projectId, reason: reason || '' });
    return res.data;
  },

  async edit(projectId: string, data: { name: string; location: string; city: string; budget: number; capacity: string; projectType: string; deadline: string; description: string }) {
    const api = createApi();
    const res = await api.post('/projects.php?action=edit', { projectId, ...data });
    return res.data;
  },

  async assign(projectId: string, leaderId: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=assign', { projectId, leaderId });
    return res.data;
  },

  async accept(projectId: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=accept', { projectId });
    return res.data;
  },

  async rejectByLeader(projectId: string, reason: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=reject_leader', { projectId, reason });
    return res.data;
  },

  async assignWorker(projectId: string, workerId: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=assign_worker', { projectId, workerId });
    return res.data;
  },

  async getById(projectId: string) {
    const api = createApi();
    const res = await api.get(`/projects.php?action=get&id=${projectId}`);
    return res.data;
  },

  async delete(projectId: string) {
    const api = createApi();
    const res = await api.post('/projects.php?action=delete', { projectId });
    return res.data;
  },
};

// ============================================
// STEPS API
// ============================================
export const stepsAPI = {
  async uploadFile(projectId: string, stepNumber: number, file: File, description?: string) {
    const token = getToken();
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('stepNumber', stepNumber.toString());
    formData.append('file', file);
    if (description) formData.append('description', description);

    const res = await axios.post(`${API_BASE_URL}/steps.php?action=upload`, formData, {
      headers: {
        'X-Session-Token': token,
      },
      timeout: 60000,
    });
    return res.data;
  },

  async completeStep(projectId: string, stepNumber: number) {
    const api = createApi();
    const res = await api.post('/steps.php?action=complete', { projectId, stepNumber });
    return res.data;
  },

  async updateMechanical(projectId: string, field: string, value: boolean) {
    const api = createApi();
    const res = await api.post('/steps.php?action=mechanical', { projectId, field, value });
    return res.data;
  },

  async approveFile(fileId: string, approved: boolean, note: string) {
    const api = createApi();
    const res = await api.post('/steps.php?action=approve', { fileId, approved, note });
    return res.data;
  },

  async setDeadline(projectId: string, stepNumber: number, deadline: string) {
    const api = createApi();
    const res = await api.post('/steps.php?action=set_deadline', { projectId, stepNumber, deadline });
    return res.data;
  },

  async setDelayReason(projectId: string, stepNumber: number, reason: string) {
    const api = createApi();
    const res = await api.post('/steps.php?action=set_delay_reason', { projectId, stepNumber, reason });
    return res.data;
  },
};

// ============================================
// USERS API
// ============================================
export const usersAPI = {
  async list() {
    const api = createApi();
    const res = await api.get('/users.php?action=list');
    return res.data;
  },

  async listLeaders() {
    const api = createApi();
    const res = await api.get('/users.php?action=leaders');
    return res.data;
  },

  async create(data: { name: string; email: string; password: string; role: string }) {
    const api = createApi();
    const res = await api.post('/users.php?action=create', data);
    return res.data;
  },

  async update(data: { id: string; name: string; email: string; password?: string; role: string }) {
    const api = createApi();
    const res = await api.post('/users.php?action=update', data);
    return res.data;
  },

  async approve(userId: string) {
    const api = createApi();
    const res = await api.post('/users.php?action=approve', { userId });
    return res.data;
  },

  async toggle(userId: string) {
    const api = createApi();
    const res = await api.post('/users.php?action=toggle', { userId });
    return res.data;
  },

  async delete(userId: string) {
    const api = createApi();
    const res = await api.post('/users.php?action=delete', { userId });
    return res.data;
  },
};

// ============================================
// BOQ API
// ============================================
export const boqAPI = {
  async add(projectId: string, item: { description: string; unit: string; quantity: number; rate: number }) {
    const api = createApi();
    const res = await api.post('/boq.php?action=add', { projectId, ...item });
    return res.data;
  },

  async update(itemId: string, item: { description: string; unit: string; quantity: number; rate: number }) {
    const api = createApi();
    const res = await api.post('/boq.php?action=update', { itemId, ...item });
    return res.data;
  },

  async remove(itemId: string) {
    const api = createApi();
    const res = await api.post('/boq.php?action=remove', { itemId });
    return res.data;
  },

  async uploadDocument(projectId: string, file: File, comment: string) {
    const token = getToken();
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);
    formData.append('comment', comment);
    const res = await axios.post(`${API_BASE_URL}/boq.php?action=upload_doc`, formData, {
      headers: { 'X-Session-Token': token },
      timeout: 60000,
    });
    return res.data;
  },

  async updateDocument(docId: string, comment: string) {
    const api = createApi();
    const res = await api.post('/boq.php?action=update_doc', { docId, comment });
    return res.data;
  },

  async removeDocument(docId: string) {
    const api = createApi();
    const res = await api.post('/boq.php?action=remove_doc', { docId });
    return res.data;
  },
};

// ============================================
// TODOS API
// ============================================
export const todosAPI = {
  async add(projectId: string, text: string, priority: string) {
    const api = createApi();
    const res = await api.post('/todos.php?action=add', { projectId, text, priority });
    return res.data;
  },

  async toggle(todoId: string) {
    const api = createApi();
    const res = await api.post('/todos.php?action=toggle', { todoId });
    return res.data;
  },

  async delete(todoId: string) {
    const api = createApi();
    const res = await api.post('/todos.php?action=delete', { todoId });
    return res.data;
  },
};

// ============================================
// NOTIFICATIONS API
// ============================================
export const notificationsAPI = {
  async list() {
    const api = createApi();
    const res = await api.get('/notifications.php?action=list');
    return res.data;
  },

  async markRead(notificationId: string) {
    const api = createApi();
    const res = await api.post('/notifications.php?action=read', { notificationId });
    return res.data;
  },

  async markAllRead() {
    const api = createApi();
    const res = await api.post('/notifications.php?action=read_all', {});
    return res.data;
  },
};

// ============================================
// FILE DOWNLOAD URL - FORCE DOWNLOAD
// ============================================
export function getFileDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/files.php?action=download&id=${fileId}&token=${getToken()}`;
}

// ============================================
// FILE VIEW URL - INLINE VIEW
// ============================================
export function getFileViewUrl(fileId: string): string {
  return `${API_BASE_URL}/files.php?action=view&id=${fileId}&token=${getToken()}`;
}

// ============================================
// FILE VIEWER FUNCTION - Opens file in new tab with proper viewer
// ============================================
export function viewFileInBrowser(fileId: string, fileName: string = 'file'): void {
  const viewUrl = getFileViewUrl(fileId);
  const downloadUrl = getFileDownloadUrl(fileId);
  
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  
  if (isPdf || isImage) {
    // Create custom viewer for PDFs and images
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { margin: 0; padding: 0; background: #1f2937; font-family: system-ui, -apple-system, sans-serif; }
            .toolbar { background: #111827; padding: 12px 24px; display: flex; align-items: center; border-bottom: 1px solid #374151; }
            .toolbar h3 { color: white; margin: 0; font-size: 16px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .btn { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; margin-left: 10px; }
            .btn-download { background: #10b981; color: white; }
            .btn-download:hover { background: #059669; }
            .btn-close { background: #4b5563; color: white; }
            .btn-close:hover { background: #6b7280; }
            .viewer-container { width: 100%; height: calc(100vh - 60px); background: white; display: flex; justify-content: center; align-items: ${isImage ? 'center' : 'flex-start'}; }
            iframe { width: 100%; height: 100%; border: none; }
            img { max-width: 100%; max-height: calc(100vh - 60px); object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <h3>📄 ${fileName}</h3>
            <div>
              <a href="${downloadUrl}" download class="btn btn-download" target="_blank">📥 Download</a>
              <button class="btn btn-close" onclick="window.close()">✕ Close</button>
            </div>
          </div>
          <div class="viewer-container">
            ${isPdf ? `<iframe src="${viewUrl}"></iframe>` : `<img src="${viewUrl}" alt="${fileName}" />`}
          </div>
        </body>
        </html>
      `);
      win.document.close();
    }
  } else {
    // For other files, try to open directly
    window.open(viewUrl, '_blank');
  }
}

// Re-export all APIs
export default {
  checkBackend,
  authAPI,
  projectsAPI,
  stepsAPI,
  usersAPI,
  boqAPI,
  todosAPI,
  notificationsAPI,
  getFileDownloadUrl,
  getFileViewUrl,
  viewFileInBrowser,
};
