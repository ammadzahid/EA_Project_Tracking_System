import { User, Project, UserRole, Notification } from './types';
import { checkBackend, authAPI, projectsAPI, usersAPI, notificationsAPI, stepsAPI, boqAPI, todosAPI, getFileDownloadUrl as apiFileUrl } from './api';

// ============================================
// DATABASE-ONLY MODE (No localStorage)
// ============================================
let _backendMode: boolean | null = null;

export async function initBackendMode(): Promise<boolean> {
  if (_backendMode !== null) return _backendMode;
  _backendMode = await checkBackend();
  if (!_backendMode) {
    console.error('Database connection required. Please setup backend first.');
  }
  return _backendMode;
}

export function isBackendActive(): boolean {
  return _backendMode === true;
}

// ============================================
// AUTH - Database Only
// ============================================
export async function loginAsync(email: string, password: string): Promise<User | null> {
  try {
    const result = await authAPI.login(email, password);
    if (result.success && result.user) {
      const user: User = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        password: '',
        role: result.user.role,
        active: true,
        approved: true,
        createdAt: result.user.createdAt || new Date().toISOString(),
      };
      return user;
    }
    return null;
  } catch (err) {
    console.error('Login failed:', err);
    return null;
  }
}

export async function signupAsync(name: string, email: string, password: string, role: UserRole): Promise<{ success: boolean; message: string }> {
  try {
    return await authAPI.signup(name, email, password, role);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Network error' };
  }
}

export async function getSessionAsync(): Promise<User | null> {
  try {
    const result = await authAPI.checkSession();
    if (result.success && result.user) {
      return {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        password: '',
        role: result.user.role,
        active: true,
        approved: true,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function logoutAsync(): Promise<void> {
  try { 
    await authAPI.logout(); 
  } catch (err) { 
    console.error('Logout error:', err);
  }
}

// ============================================
// PROJECTS - Database Only
// ============================================
export async function fetchProjectsAsync(): Promise<Project[]> {
  try {
    const result = await projectsAPI.list();
    if (result.success) return result.projects;
    return [];
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    return [];
  }
}

export async function createProjectAsync(formData: FormData): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.create(formData);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Upload failed' };
  }
}

export async function updateProjectAsync(projectId: string, data: any): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.edit(projectId, data);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Update failed' };
  }
}

export async function approveProjectAsync(projectId: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.approve(projectId);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function assignLeaderAsync(projectId: string, leaderId: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.assign(projectId, leaderId);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function assignProjectAsync(projectId: string, leaderId: string): Promise<{ success: boolean; message: string }> {
  // Alias for assignLeaderAsync for backward compatibility
  return assignLeaderAsync(projectId, leaderId);
}

export async function acceptProjectAsync(projectId: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.accept(projectId);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function rejectByLeaderAsync(projectId: string, reason: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.rejectByLeader(projectId, reason);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function rejectProjectAsync(projectId: string, reason: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.reject(projectId, reason);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function editProjectAsync(projectId: string, data: any): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.edit(projectId, data);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function deleteProjectAsync(projectId: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.delete(projectId);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function assignWorkerAsync(projectId: string, workerId: string): Promise<{ success: boolean; message: string }> {
  try {
    return await projectsAPI.assignWorker(projectId, workerId);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function fetchProjectByIdAsync(projectId: string): Promise<Project | null> {
  try {
    const result = await projectsAPI.getById(projectId);
    if (result.success) return result.project;
    return null;
  } catch (err) {
    console.error('Failed to fetch project:', err);
    return null;
  }
}

// ============================================
// USERS - Database Only
// ============================================
export async function fetchUsersAsync(): Promise<User[]> {
  try {
    const result = await usersAPI.list();
    if (result.success) return result.users;
    return [];
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return [];
  }
}

export async function fetchLeadersAsync(): Promise<User[]> {
  try {
    const result = await usersAPI.listLeaders();
    if (result.success) return result.leaders;
    return [];
  } catch (err) {
    console.error('Failed to fetch leaders:', err);
    return [];
  }
}

export async function createUserAsync(data: { name: string; email: string; password: string; role: string }): Promise<{ success: boolean; message: string }> {
  try { 
    return await usersAPI.create(data); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function updateUserAsync(data: { id: string; name: string; email: string; password?: string; role: string }): Promise<{ success: boolean; message: string }> {
  try { 
    return await usersAPI.update(data); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function approveUserAsync(userId: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await usersAPI.approve(userId); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function toggleUserAsync(userId: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await usersAPI.toggle(userId); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function deleteUserAsync(userId: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await usersAPI.delete(userId); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

// ============================================
// NOTIFICATIONS - Database Only
// ============================================
export async function fetchNotificationsAsync(_role: UserRole): Promise<Notification[]> {
  try {
    const result = await notificationsAPI.list();
    if (result.success) return result.notifications;
    return [];
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return [];
  }
}

export async function markNotificationReadAsync(notificationId: string): Promise<void> {
  try { await notificationsAPI.markRead(notificationId); } catch (err) { /* silent */ }
}

export async function markAllNotificationsReadAsync(): Promise<void> {
  try { await notificationsAPI.markAllRead(); } catch (err) { /* silent */ }
}

// ============================================
// STEPS - Database Only
// ============================================
export async function uploadStepFileAsync(projectId: string, stepNumber: number, file: File, description?: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await stepsAPI.uploadFile(projectId, stepNumber, file, description); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Upload failed' };
  }
}

export async function completeStepAsync(projectId: string, stepNumber: number): Promise<{ success: boolean; message: string }> {
  try { 
    return await stepsAPI.completeStep(projectId, stepNumber); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function updateMechanicalAsync(projectId: string, field: string, value: boolean): Promise<{ success: boolean; message: string }> {
  try { 
    return await stepsAPI.updateMechanical(projectId, field, value); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function approveStepFileAsync(fileId: string, approved: boolean, note: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await stepsAPI.approveFile(fileId, approved, note); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function setStepDeadlineAsync(projectId: string, stepNumber: number, deadline: string): Promise<{ success: boolean; message: string }> {
  try {
    return await stepsAPI.setDeadline(projectId, stepNumber, deadline);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed to set deadline' };
  }
}

export async function setDelayReasonAsync(projectId: string, stepNumber: number, reason: string): Promise<{ success: boolean; message: string }> {
  try {
    return await stepsAPI.setDelayReason(projectId, stepNumber, reason);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed to save delay reason' };
  }
}

// ============================================
// BOQ - Database Only
// ============================================
export async function addBoqAsync(projectId: string, item: { description: string; unit: string; quantity: number; rate: number }): Promise<{ success: boolean; message: string }> {
  try { 
    return await boqAPI.add(projectId, item); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function updateBoqAsync(itemId: string, item: { description: string; unit: string; quantity: number; rate: number }): Promise<{ success: boolean; message: string }> {
  try { 
    return await boqAPI.update(itemId, item); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function removeBoqAsync(itemId: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await boqAPI.remove(itemId); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function uploadBoqDocAsync(projectId: string, file: File, comment: string): Promise<{ success: boolean; message: string }> {
  try {
    return await boqAPI.uploadDocument(projectId, file, comment);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function updateBoqDocAsync(docId: string, comment: string): Promise<{ success: boolean; message: string }> {
  try {
    return await boqAPI.updateDocument(docId, comment);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function removeBoqDocAsync(docId: string): Promise<{ success: boolean; message: string }> {
  try {
    return await boqAPI.removeDocument(docId);
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

// ============================================
// TODOS - Database Only
// ============================================
export async function addTodoAsync(projectId: string, text: string, priority: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await todosAPI.add(projectId, text, priority); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function toggleTodoAsync(todoId: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await todosAPI.toggle(todoId); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

export async function deleteTodoAsync(todoId: string): Promise<{ success: boolean; message: string }> {
  try { 
    return await todosAPI.delete(todoId); 
  } catch (err: unknown) {
    const error = err as { response?: { data?: { message?: string } } };
    return { success: false, message: error?.response?.data?.message || 'Failed' };
  }
}

// ============================================
// UTILITY FUNCTIONS - Add these at the bottom
// ============================================

// ===== NEW FUNCTIONS FOR FILE VIEWING =====
export const getFileViewUrl = (fileId: string): string => {
  // Get base URL from apiFileUrl function
  const baseUrl = apiFileUrl(fileId).replace('action=download', 'action=view');
  return baseUrl;
};

export const viewFileInBrowser = (fileId: string, fileName: string = 'file'): void => {
  const viewUrl = getFileViewUrl(fileId);
  const downloadUrl = apiFileUrl(fileId);
  
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
            .viewer-container { width: 100%; height: calc(100vh - 60px); background: white; }
            iframe { width: 100%; height: 100%; border: none; }
            img { max-width: 100%; max-height: calc(100vh - 60px); display: block; margin: 0 auto; }
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
};

// Re-export API functions
export { 
  projectsAPI, 
  stepsAPI, 
  usersAPI, 
  boqAPI, 
  todosAPI, 
  notificationsAPI, 
  authAPI, 
  apiFileUrl as getFileDownloadUrl 
};
