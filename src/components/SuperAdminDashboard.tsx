import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, XCircle, Users, FileText, Plus, Trash2, X, Eye, 
  Download, Edit, Shield, BarChart3, Bell, UserCheck, Loader2, 
  AlertTriangle, Upload, ChevronLeft, ChevronRight, Clock
} from 'lucide-react';
import { User, Project, BOQItem } from '../types';
import {
  fetchProjectsAsync, fetchProjectByIdAsync, fetchUsersAsync, fetchNotificationsAsync,
  approveProjectAsync, rejectProjectAsync, editProjectAsync, deleteProjectAsync,
  createProjectAsync,
  createUserAsync, updateUserAsync, approveUserAsync, toggleUserAsync, deleteUserAsync,
  addBoqAsync, updateBoqAsync, removeBoqAsync,
  uploadBoqDocAsync, updateBoqDocAsync, removeBoqDocAsync,
  getFileDownloadUrl,
  viewFileInBrowser,
  markNotificationReadAsync,
  markAllNotificationsReadAsync,
} from '../store';

import {
  generateProjectPDF,
  viewProjectPDF,
  viewStepDocument,
  generateAllProjectsExcel,
  generateProgressPDF
} from '../utils/reports';

// ===== TYPES =====
interface Props { user: User; }
type Tab = 'projects' | 'users' | 'reports' | 'notifications';
type DeleteConfirmType = { type: 'boqItem' | 'boqDoc' | 'user' | 'project'; id: string; name: string } | null;
type RejectModalType = { type: 'project'; id: string } | null;

// ===== INITIAL STATES =====
const initialProjectForm = {
  name: '', location: '', city: '', budget: 0, capacity: '', 
  projectType: 'Residential' as Project['projectType'], deadline: '', description: ''
};

const initialUserForm = { 
  name: '', email: '', password: '', role: 'selling' as User['role'] 
};

const initialBoqForm = { 
  description: '', unit: 'pcs', quantity: 1, rate: 0 
};

export function SuperAdminDashboard({ user: _user }: Props) {
  // ===== STATE =====
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<import('../types').Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [boqProject, setBoqProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form States
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [boqForm, setBoqForm] = useState(initialBoqForm);
  const [editingBoqItem, setEditingBoqItem] = useState<BOQItem | null>(null);
  
  // File States
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [projectFilePreview, setProjectFilePreview] = useState('');
  const [projectPlanningFile, setProjectPlanningFile] = useState<File | null>(null);
  const [projectPlanningFilePreview, setProjectPlanningFilePreview] = useState('');
  const [boqDocFile, setBoqDocFile] = useState<File | null>(null);
  const [boqDocComment, setBoqDocComment] = useState('');
  const [editingDoc, setEditingDoc] = useState<import('../types').BOQDocument | null>(null);
  const [editDocComment, setEditDocComment] = useState('');
  
  // Pagination
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const PAGE_SIZE = 5;
  
  // UI States
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmType>(null);
  const [rejectModal, setRejectModal] = useState<RejectModalType>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [projectFormError, setProjectFormError] = useState('');
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState('');
  const [uploadDocSuccess, setUploadDocSuccess] = useState('');
  const [boqFileInputKey, setBoqFileInputKey] = useState(0);
  const boqFileInputRef = useRef<HTMLInputElement>(null);

  // ===== COMPUTED VALUES =====
  const pendingUsers = users.filter(u => !u.approved);
  const unreadNotifs = notifications.filter(n => !n.read).length;
  const pendingProjects = projects.filter(p => p.status === 'new').length;
  const activeUsers = users.filter(u => u.active && u.approved).length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  // ===== STYLES =====
  const statusColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', 
    approved: 'bg-green-100 text-green-700', 
    assigned: 'bg-purple-100 text-purple-700',
    accepted: 'bg-indigo-100 text-indigo-700', 
    in_progress: 'bg-amber-100 text-amber-700', 
    completed: 'bg-emerald-100 text-emerald-700', 
    rejected: 'bg-red-100 text-red-700',
  };

  const roleColor: Record<string, string> = { 
    selling: 'bg-blue-100 text-blue-700', 
    superadmin: 'bg-red-100 text-red-700', 
    planning: 'bg-purple-100 text-purple-700', 
    teamleader: 'bg-amber-100 text-amber-700' 
  };

  // ===== DATA LOADING =====
  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, usersData, notificationsData] = await Promise.all([
        fetchProjectsAsync(), 
        fetchUsersAsync(), 
        fetchNotificationsAsync('superadmin')
      ]);
      setProjects(projectsData);
      setUsers(usersData);
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ===== PROJECT HANDLERS =====
  const handleApproveProject = async (project: Project) => {
    await approveProjectAsync(project.id);
    await loadData();
  };

  const handleRejectProject = async (projectId: string) => {
    if (!rejectReason.trim()) {
      setRejectError('⚠️ Reject reason is MANDATORY! Please describe why you are rejecting.');
      return;
    }
    await rejectProjectAsync(projectId, rejectReason);
    await loadData();
    setRejectModal(null);
    setRejectReason('');
    setRejectError('');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectFormError('');

    if (!projectForm.name || !projectForm.location || !projectForm.city || 
        !projectForm.budget || !projectForm.capacity || !projectForm.deadline || !projectForm.description) {
      setProjectFormError('All fields are required');
      return;
    }
    if (!projectFile) { 
      setProjectFormError('Quotation for Admin is mandatory!'); 
      return; 
    }

    setProjectSubmitting(true);
    const formData = new FormData();
    Object.entries(projectForm).forEach(([key, value]) => formData.append(key, value.toString()));
    formData.append('quotation_admin', projectFile);
    if (projectPlanningFile) formData.append('quotation_planning', projectPlanningFile);

    const result = await createProjectAsync(formData);
    if (result.success) {
      await loadData();
      closeProjectModal();
    } else {
      setProjectFormError(result.message || 'Failed to create project');
    }
    setProjectSubmitting(false);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name, 
      location: project.location, 
      city: project.city, 
      budget: project.budget,
      capacity: project.capacity, 
      projectType: project.projectType, 
      deadline: project.deadline, 
      description: project.description,
    });
    setShowProjectModal(true);
  };

  const handleSaveEditProject = async () => {
    if (!editingProject) return;
    await editProjectAsync(editingProject.id, projectForm);
    await loadData();
    setEditingProject(null);
    setProjectForm(initialProjectForm);
  };

  // ===== BOQ HANDLERS =====
  const refreshBoqProject = async (projectId: string) => {
    await loadData();
    const updated = await fetchProjectByIdAsync(projectId);
    if (updated) setBoqProject(updated);
  };

  const handleAddBoq = async (project: Project) => {
    if (!boqForm.description.trim()) return;
    await addBoqAsync(project.id, boqForm);
    setBoqForm(initialBoqForm);
    await refreshBoqProject(project.id);
  };

  const handleUpdateBoq = async (project: Project) => {
    if (!editingBoqItem || !boqForm.description.trim()) return;
    await updateBoqAsync(editingBoqItem.id, boqForm);
    setEditingBoqItem(null);
    setBoqForm(initialBoqForm);
    await refreshBoqProject(project.id);
  };

  const handleRemoveBoq = async (project: Project, itemId: string) => {
    await removeBoqAsync(itemId);
    await refreshBoqProject(project.id);
  };

  // ===== BOQ DOCUMENT HANDLERS =====
  const handleUploadBoqDoc = async (project: Project) => {
    if (!boqDocFile) { setUploadDocError('❌ Please select a file first'); return; }
    setUploadingDoc(true);
    setUploadDocError('');
    setUploadDocSuccess('');
    const result = await uploadBoqDocAsync(project.id, boqDocFile, boqDocComment);
    setUploadingDoc(false);
    if (result.success) {
      setBoqDocFile(null);
      setBoqDocComment('');
      setBoqFileInputKey(k => k + 1);
      setUploadDocSuccess('✅ Document uploaded!');
      setTimeout(() => setUploadDocSuccess(''), 3000);
      await refreshBoqProject(project.id);
    } else {
      setUploadDocError('❌ Upload failed: ' + (result.message || 'Unknown error'));
    }
  };

  const handleUpdateDocComment = async (project: Project) => {
    if (!editingDoc) return;
    await updateBoqDocAsync(editingDoc.id, editDocComment);
    setEditingDoc(null);
    setEditDocComment('');
    await refreshBoqProject(project.id);
  };

  // ===== USER HANDLERS =====
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await updateUserAsync({ id: editingUser.id, ...userForm });
    } else {
      await createUserAsync(userForm);
    }
    await loadData();
    closeUserModal();
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({ 
      name: user.name, 
      email: user.email, 
      password: '', 
      role: user.role 
    });
    setShowUserModal(true);
  };

  const handleApproveUser = async (user: User) => {
    await approveUserAsync(user.id);
    await loadData();
  };

  const handleToggleUser = async (user: User) => {
    await toggleUserAsync(user.id);
    await loadData();
  };

  const handleDeleteUser = async (user: User) => {
    setDeleteConfirm({ type: 'user', id: user.id, name: user.name });
  };

  // ===== DELETE CONFIRMATION =====
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    
    switch (deleteConfirm.type) {
      case 'boqItem':
        await removeBoqAsync(deleteConfirm.id);
        if (boqProject) await refreshBoqProject(boqProject.id);
        break;
      case 'boqDoc':
        await removeBoqDocAsync(deleteConfirm.id);
        if (boqProject) await refreshBoqProject(boqProject.id);
        break;
      case 'user':
        await deleteUserAsync(deleteConfirm.id);
        await loadData();
        break;
      case 'project':
        await deleteProjectAsync(deleteConfirm.id);
        await loadData();
        break;
    }
    setDeleteConfirm(null);
  };

  // ===== FILE HANDLERS =====
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProjectFile(file);
      setProjectFilePreview(file.name);
    }
  };

  const downloadFile = (file: { id?: string; name: string }) => {
    if (file.id) { 
      window.open(getFileDownloadUrl(file.id), '_blank'); 
    }
  };

  const viewFile = (file: { id: string; name: string }) => {
    viewFileInBrowser(file.id, file.name);
  };

  // ===== MODAL CONTROLS =====
  const closeProjectModal = () => {
    setShowProjectModal(false);
    setProjectForm(initialProjectForm);
    setProjectFile(null);
    setProjectFilePreview('');
    setProjectPlanningFile(null);
    setProjectPlanningFilePreview('');
    setProjectFormError('');
    setEditingProject(null);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setUserForm(initialUserForm);
    setEditingUser(null);
  };

  const openBoqModal = (project: Project) => {
    setBoqProject(project);
    setBoqForm(initialBoqForm);
    setEditingBoqItem(null);
  };

  // ===== RENDER =====
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <span className="ml-3 text-slate-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">👑 Super Admin Dashboard</h2>
        <p className="text-slate-500">Work orders, approvals, BOQ, users & reports</p>
      </div>

      {/* Stats Cards */}
      <StatsCards 
        projects={projects}
        pendingProjects={pendingProjects}
        pendingUsers={pendingUsers.length}
        activeUsers={activeUsers}
        completedProjects={completedProjects}
      />

      {/* Tab Navigation */}
      <TabNavigation 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingUsers={pendingUsers.length}
        unreadNotifs={unreadNotifs}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'projects' && (
          <ProjectsTab
            projects={projects}
            pageSize={PAGE_SIZE}
            onApprove={handleApproveProject}
            onReject={(id: string) => {
              setRejectModal({ type: 'project', id });
              setRejectReason('');
              setRejectError('');
            }}
            onEdit={handleEditProject}
            onView={setSelectedProject}
            onBoqEdit={openBoqModal}
            onNewProject={() => setShowProjectModal(true)}
            onDelete={(project: Project) => setDeleteConfirm({ type: 'project', id: project.id, name: project.name })}
            statusColor={statusColor}
            downloadFile={downloadFile}
            viewFile={viewFile}
            viewProjectPDF={viewProjectPDF}
            generateProjectPDF={generateProjectPDF}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            onAddUser={() => setShowUserModal(true)}
            onEditUser={handleEditUser}
            onApproveUser={handleApproveUser}
            onToggleUser={handleToggleUser}
            onDeleteUser={handleDeleteUser}
            roleColor={roleColor}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab projects={projects} />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            notifications={notifications}
            onMarkAllRead={async () => { await markAllNotificationsReadAsync(); await loadData(); }}
            onMarkRead={async (id: string) => { await markNotificationReadAsync(id); await loadData(); }}
          />
        )}
      </div>

      {/* Modals */}
      {showProjectModal && (
        <ProjectModal
          isEditing={!!editingProject}
          form={projectForm}
          setForm={setProjectForm}
          file={projectFile}
          filePreview={projectFilePreview}
          onFileChange={handleFileChange}
          planningFile={projectPlanningFile}
          planningFilePreview={projectPlanningFilePreview}
          onPlanningFileChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0];
            if (f) { setProjectPlanningFile(f); setProjectPlanningFilePreview(f.name); }
          }}
          error={projectFormError}
          isSubmitting={projectSubmitting}
          onSubmit={editingProject ? handleSaveEditProject : handleCreateProject}
          onClose={closeProjectModal}
        />
      )}

      {showUserModal && (
        <UserModal
          isEditing={!!editingUser}
          form={userForm}
          setForm={setUserForm}
          onSubmit={handleAddUser}
          onClose={closeUserModal}
        />
      )}

      {selectedProject && (
        <ViewProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          viewFile={viewFile}
          downloadFile={downloadFile}
          viewProjectPDF={viewProjectPDF}
          generateProjectPDF={generateProjectPDF}
          viewStepDocument={viewStepDocument}
        />
      )}

      {boqProject && (
        <BOQModal
          project={boqProject}
          onClose={() => setBoqProject(null)}
          boqForm={boqForm}
          setBoqForm={setBoqForm}
          editingBoqItem={editingBoqItem}
          setEditingBoqItem={setEditingBoqItem}
          onAddBoq={handleAddBoq}
          onUpdateBoq={handleUpdateBoq}
          onRemoveBoq={handleRemoveBoq}
          boqDocFile={boqDocFile}
          setBoqDocFile={setBoqDocFile}
          boqDocComment={boqDocComment}
          setBoqDocComment={setBoqDocComment}
          uploadingDoc={uploadingDoc}
          onUploadBoqDoc={handleUploadBoqDoc}
          editingDoc={editingDoc}
          setEditingDoc={setEditingDoc}
          editDocComment={editDocComment}
          setEditDocComment={setEditDocComment}
          onUpdateDocComment={handleUpdateDocComment}
          onDeleteConfirm={setDeleteConfirm}
          viewFile={viewFile}
          downloadFile={downloadFile}
          uploadDocError={uploadDocError}
          uploadDocSuccess={uploadDocSuccess}
          boqFileInputKey={boqFileInputKey}
          boqFileInputRef={boqFileInputRef}
        />
      )}

      {rejectModal && (
        <RejectModal
          projectId={rejectModal.id}
          reason={rejectReason}
          setReason={setRejectReason}
          error={rejectError}
          onReject={handleRejectProject}
          onClose={() => {
            setRejectModal(null);
            setRejectReason('');
            setRejectError('');
          }}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          deleteConfirm={deleteConfirm}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ===== SUB-COMPONENTS =====

// Stats Cards Component
function StatsCards({ projects, pendingProjects, pendingUsers, activeUsers, completedProjects }: any) {
  const stats = [
    { label: 'Total Projects', count: projects.length, color: 'bg-blue-500' },
    { label: 'Pending Approval', count: pendingProjects, color: 'bg-amber-500' },
    { label: 'Pending Users', count: pendingUsers, color: 'bg-red-500' },
    { label: 'Active Users', count: activeUsers, color: 'bg-green-500' },
    { label: 'Completed', count: completedProjects, color: 'bg-emerald-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {stats.map(stat => (
        <div key={stat.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-white font-bold text-lg mb-2`}>
            {stat.count}
          </div>
          <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

// Tab Navigation Component
function TabNavigation({ activeTab, setActiveTab, pendingUsers, unreadNotifs }: any) {
  const tabs = [
    { key: 'projects' as const, label: 'Projects & BOQ', icon: FileText },
    { key: 'users' as const, label: 'Users', icon: Users, badge: pendingUsers },
    { key: 'reports' as const, label: 'Reports', icon: BarChart3 },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadNotifs },
  ];

  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab.key 
              ? 'bg-white shadow-sm text-orange-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{tab.label}</span>
          {tab.badge > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Projects Tab Component
function ProjectsTab({ projects, pageSize, onApprove, onReject, onEdit, onView, onBoqEdit, onNewProject, onDelete, statusColor, downloadFile, viewFile, viewProjectPDF, generateProjectPDF }: any) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'approved' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const today = Date.now();

  const urgentProjects = projects.filter((p: Project) => {
    if (['completed', 'rejected', 'new'].includes(p.status)) return false;
    const days = Math.ceil((new Date(p.deadline).getTime() - today) / 86400000);
    return days <= 7;
  });

  const filterMap: Record<string, Project[]> = {
    all:         projects,
    new:         projects.filter((p: Project) => p.status === 'new'),
    approved:    projects.filter((p: Project) => p.status === 'approved'),
    assigned:    projects.filter((p: Project) => p.status === 'assigned'),
    accepted:    projects.filter((p: Project) => p.status === 'accepted'),
    in_progress: projects.filter((p: Project) => p.status === 'in_progress'),
    completed:   projects.filter((p: Project) => p.status === 'completed'),
    rejected:    projects.filter((p: Project) => p.status === 'rejected'),
  };

  const filtered = (filterMap[statusFilter] || []).filter((p: Project) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase()) ||
    (p.workOrderNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const filters = [
    { key: 'all',         label: `All (${filterMap.all.length})` },
    { key: 'new',         label: `Pending (${filterMap.new.length})` },
    { key: 'approved',    label: `Approved (${filterMap.approved.length})` },
    { key: 'assigned',    label: `Assigned (${filterMap.assigned.length})` },
    { key: 'accepted',    label: `Accepted (${filterMap.accepted.length})` },
    { key: 'in_progress', label: `In Progress (${filterMap.in_progress.length})` },
    { key: 'completed',   label: `Completed (${filterMap.completed.length})` },
    { key: 'rejected',    label: `Rejected (${filterMap.rejected.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search project, city, work order..."
            className="w-full pl-4 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <button onClick={onNewProject} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 shadow-lg transition-all flex-shrink-0">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(f.key as typeof statusFilter); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === f.key ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Deadline Warning Section */}
      {urgentProjects.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-red-600" />
            <h3 className="font-bold text-red-700 text-sm">⚠️ Deadline Alert — {urgentProjects.length} project(s) running out of time!</h3>
          </div>
          <div className="space-y-2">
            {urgentProjects.map((p: Project) => {
              const days = Math.ceil((new Date(p.deadline).getTime() - today) / 86400000);
              return (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2 border border-red-100">
                  <div>
                    <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{p.city} | {p.capacity}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                    <button onClick={() => onView(p)} className="p-1.5 hover:bg-orange-100 rounded-lg">
                      <Eye className="w-3.5 h-3.5 text-orange-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Projects List */}
      {paginated.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{search ? 'No projects match your search' : 'No projects in this category'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map((project: Project) => (
            <ProjectCard key={project.id} project={project} onApprove={onApprove} onReject={onReject} onEdit={onEdit} onView={onView} onBoqEdit={onBoqEdit} onDelete={onDelete} statusColor={statusColor} downloadFile={downloadFile} viewFile={viewFile} viewProjectPDF={viewProjectPDF} generateProjectPDF={generateProjectPDF} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination current={page} total={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

// Pagination Component
function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onChange(Math.max(1, current - 1))} disabled={current === 1}
        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map(page => (
        <button key={page} onClick={() => onChange(page)}
          className={`w-8 h-8 rounded-lg text-sm font-medium ${current === page ? 'bg-orange-500 text-white' : 'border border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
          {page}
        </button>
      ))}
      <button onClick={() => onChange(Math.min(total, current + 1))} disabled={current === total}
        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  );
}

// Project Card Component
function ProjectCard({ project, onApprove, onReject, onEdit, onView, onBoqEdit, onDelete, statusColor, downloadFile }: any) {
  const totalBOQ = project.boq?.reduce((sum: number, item: BOQItem) => sum + item.amount, 0) || 0;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h3 className="font-bold text-slate-800">{project.name}</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[project.status]}`}>
              {project.status.replace('_', ' ').toUpperCase()}
            </span>
            {project.workOrderNumber && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                {project.workOrderNumber}
              </span>
            )}
          </div>
          
          <p className="text-sm text-slate-500">
            {project.city} | {project.capacity} | PKR {project.budget.toLocaleString()} | {project.projectType}
          </p>
          
          {project.rejectedReason && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">
              Reject Reason: {project.rejectedReason}
            </p>
          )}
          
          {project.boq && project.boq.length > 0 && (
            <p className="text-xs text-purple-600 mt-1">
              BOQ: {project.boq.length} items | Total: PKR {totalBOQ.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {project.status === 'new' && (
            <>
              <button
                onClick={() => onApprove(project)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve + WO
              </button>
              <button
                onClick={() => onReject(project.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}

          <button
            onClick={() => onEdit(project)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
            title="Edit Project Details"
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>

          {project.quotationFile && (
            <>
              <button
                onClick={() => viewFileInBrowser(project.quotationFile.id, project.quotationFile.name)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100"
                title="View Admin Quotation"
              >
                <Eye className="w-3.5 h-3.5" /> Admin Q
              </button>
              <button
                onClick={() => downloadFile(project.quotationFile)}
                className="p-2 hover:bg-blue-50 rounded-lg"
                title="Download Admin Quotation"
              >
                <Download className="w-4 h-4 text-blue-600" />
              </button>
            </>
          )}

          {project.quotationPlanningFile && (
            <>
              <button
                onClick={() => viewFileInBrowser(project.quotationPlanningFile.id, project.quotationPlanningFile.name)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100"
                title="View Planning Quotation"
              >
                <Eye className="w-3.5 h-3.5" /> Plan Q
              </button>
              <button
                onClick={() => downloadFile(project.quotationPlanningFile)}
                className="p-2 hover:bg-purple-50 rounded-lg"
                title="Download Planning Quotation"
              >
                <Download className="w-4 h-4 text-purple-600" />
              </button>
            </>
          )}

          <button
            onClick={() => onBoqEdit(project)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100"
          >
            <Edit className="w-3.5 h-3.5" /> BOQ
          </button>

          <button
            onClick={() => viewProjectPDF(project)}
            className="p-2 hover:bg-orange-50 rounded-lg"
            title="View System PDF"
          >
            <Eye className="w-4 h-4 text-orange-600" />
          </button>

          <button
            onClick={() => generateProjectPDF(project)}
            className="p-2 hover:bg-green-50 rounded-lg"
            title="Download Full PDF"
          >
            <Download className="w-4 h-4 text-green-600" />
          </button>

          <button
            onClick={() => onView(project)}
            className="p-2 hover:bg-slate-50 rounded-lg"
            title="View Details"
          >
            <FileText className="w-4 h-4 text-slate-600" />
          </button>

          <button
              onClick={() => onDelete(project)}
              className="p-2 hover:bg-red-50 rounded-lg border border-red-200"
              title="Delete Project">
              <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// View Project Modal Component
function ViewProjectModal({ project, onClose, downloadFile, viewProjectPDF, generateProjectPDF, viewStepDocument }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{project.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Location" value={project.location} />
          <DetailItem label="City" value={project.city} />
          <DetailItem label="Budget" value={`PKR ${project.budget.toLocaleString()}`} />
          <DetailItem label="Capacity" value={project.capacity} />
          <DetailItem label="Type" value={project.projectType} />
          <DetailItem label="Deadline" value={new Date(project.deadline).toLocaleDateString()} />
          <div className="col-span-2">
            <DetailItem label="Description" value={project.description} />
          </div>
          {project.rejectedReason && (
            <div className="col-span-2">
              <p className="text-red-500 font-medium">Rejected Reason:</p>
              <p className="text-red-700 bg-red-50 px-3 py-2 rounded-lg">{project.rejectedReason}</p>
            </div>
          )}
        </div>

        {/* Quotation Files Section */}
        {(project.quotationFile || project.quotationPlanningFile) && (
          <div className="border-t border-slate-200 pt-4 mt-2 space-y-3">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              Quotation Files
            </h4>
            {project.quotationFile && (
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">📋 Quotation for Admin</p>
                <FileDisplay
                  file={project.quotationFile}
                  onView={() => viewFileInBrowser(project.quotationFile.id, project.quotationFile.name)}
                  onDownload={() => downloadFile(project.quotationFile)}
                />
              </div>
            )}
            {project.quotationPlanningFile && (
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">📐 Quotation for Planning Team</p>
                <FileDisplay
                  file={project.quotationPlanningFile}
                  onView={() => viewFileInBrowser(project.quotationPlanningFile.id, project.quotationPlanningFile.name)}
                  onDownload={() => downloadFile(project.quotationPlanningFile)}
                />
              </div>
            )}
          </div>
        )}

        {/* PDF Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => viewProjectPDF(project)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-100"
          >
            <Eye className="w-4 h-4" /> View System PDF
          </button>
          <button
            onClick={() => generateProjectPDF(project)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-600 rounded-xl text-sm font-medium hover:bg-green-100"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>

        {/* Steps */}
        {project.steps && project.steps.map((step: any) => (
          <StepItem
            key={step.step}
            step={step}
            viewStepDocument={viewStepDocument}
          />
        ))}
      </div>
    </div>
  );
}

// Detail Item Component
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

// File Display Component
function FileDisplay({ file, onView, onDownload }: { file: any; onView: () => void; onDownload: () => void }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-slate-500">
          {file.uploadedAt && new Date(file.uploadedAt).toLocaleString()}
          {file.size && ` • ${(file.size / 1024).toFixed(1)} KB`}
        </p>
      </div>
      <div className="flex gap-2 ml-3">
        <button onClick={onView} className="p-2 hover:bg-orange-100 rounded-lg transition-colors" title="View File">
          <Eye className="w-4 h-4 text-orange-600" />
        </button>
        <button onClick={onDownload} className="p-2 hover:bg-blue-100 rounded-lg transition-colors" title="Download">
          <Download className="w-4 h-4 text-blue-600" />
        </button>
      </div>
    </div>
  );
}

// Step Item Component
function StepItem({ step, viewStepDocument }: any) {
  const statusColor = step.status === 'completed' || step.status === 'approved'
    ? 'bg-green-500 text-white'
    : step.status === 'in_progress'
    ? 'bg-amber-500 text-white'
    : 'bg-slate-200 text-slate-500';

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${statusColor}`}>
        {step.step}
      </div>
      <span className="text-sm text-slate-600 flex-1">{step.name}</span>
      <span className="text-xs">{step.files?.length || 0} files</span>
      {step.files && step.files.length > 0 && (
        <div className="flex gap-1">
          {step.files.map((file: any) => (
            <button
              key={file.id}
              onClick={() => viewStepDocument(file)}
              className="p-1 hover:bg-orange-50 rounded"
              title={`View: ${file.name}`}
            >
              <Eye className="w-3.5 h-3.5 text-orange-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Users Tab Component
function UsersTab({ users, onAddUser, onEditUser, onApproveUser, onToggleUser, onDeleteUser, roleColor }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onAddUser}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user: User) => (
              <UserRow
                key={user.id}
                user={user}
                onEdit={onEditUser}
                onApprove={onApproveUser}
                onToggle={onToggleUser}
                onDelete={onDeleteUser}
                roleColor={roleColor}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// User Row Component
function UserRow({ user, onEdit, onApprove, onToggle, onDelete, roleColor }: any) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-slate-800">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColor[user.role]}`}>
          {user.role.toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {!user.approved ? (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Pending</span>
          ) : user.active ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
          ) : (
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">Inactive</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {!user.approved && (
            <button
              onClick={() => onApprove(user)}
              className="p-1.5 hover:bg-green-50 rounded-lg text-green-600"
              title="Approve User"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onToggle(user)}
            className={`p-1.5 hover:bg-amber-50 rounded-lg ${user.active ? 'text-amber-600' : 'text-green-600'}`}
            title={user.active ? 'Deactivate' : 'Activate'}
          >
            <Shield className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(user)}
            className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Reports Tab Component
function ReportsTab({ projects }: any) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Generate Reports</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard
          title="All Projects Excel"
          description="Download complete project list with all details"
          icon={FileText}
          onClick={() => generateAllProjectsExcel(projects)}
          color="bg-green-500"
        />
        <ReportCard
          title="Progress Report"
          description="Generate step-by-step progress report"
          icon={BarChart3}
          onClick={() => generateProgressPDF(projects)}
          color="bg-blue-500"
        />
      </div>
    </div>
  );
}

// Report Card Component
function ReportCard({ title, description, icon: Icon, onClick, color }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-orange-300 hover:shadow-md transition-all text-left"
    >
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-800">{title}</h4>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
    </button>
  );
}

// Notifications Tab Component
function NotificationsTab({ notifications, onMarkAllRead, onMarkRead }: any) {
  const unread = notifications.filter((n: any) => !n.read);
  const read = notifications.filter((n: any) => n.read);

  const notifIcon: Record<string, string> = {
    project_assigned: '📋', project_accepted: '✅', step_completed: '🔧',
    deadline_warning: '⏰', approval_needed: '👑', signup_request: '👤',
  };

  return (
    <div className="space-y-4">
      {/* Header with Mark All Read */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="font-semibold text-slate-700">Notifications</span>
          {unread.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{unread.length} new</span>
          )}
        </div>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead}
            className="text-xs text-orange-600 hover:text-orange-700 font-medium px-3 py-1.5 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
            ✓ Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
          {/* Unread first */}
          {unread.map((notif: any) => (
            <div key={notif.id} className="flex items-start gap-3 p-4 bg-orange-50 hover:bg-orange-100 transition-colors">
              <span className="text-lg mt-0.5">{notifIcon[notif.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 font-medium">{notif.message}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(notif.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => onMarkRead(notif.id)}
                className="text-xs text-slate-400 hover:text-green-600 px-2 py-1 rounded hover:bg-green-50 flex-shrink-0 transition-colors"
                title="Mark as read">
                ✓
              </button>
            </div>
          ))}
          {/* Read notifications (muted) */}
          {read.length > 0 && (
            <>
              {unread.length > 0 && (
                <div className="px-4 py-2 bg-slate-50">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Previously read</p>
                </div>
              )}
              {read.map((notif: any) => (
                <div key={notif.id} className="flex items-start gap-3 p-4 opacity-50">
                  <span className="text-lg mt-0.5">{notifIcon[notif.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-600">{notif.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(notif.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Project Modal Component
function ProjectModal({ isEditing, form, setForm, file, filePreview, onFileChange, planningFile, planningFilePreview, onPlanningFileChange, error, isSubmitting, onSubmit, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {isEditing ? '✏️ Edit Project' : '📋 New Project'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing ? 'Update project details' : 'Admin is creating this project directly'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Project Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" placeholder="e.g. Lahore Solar 10kW" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Location <span className="text-red-500">*</span></label>
              <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Full address" required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">City <span className="text-red-500">*</span></label>
              <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Lahore" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Budget (PKR) <span className="text-red-500">*</span></label>
              <input type="number" value={form.budget || ''} onChange={e => setForm({ ...form, budget: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="1500000" required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Capacity <span className="text-red-500">*</span></label>
              <input type="text" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="10kW" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Type</label>
              <select value={form.projectType} onChange={e => setForm({ ...form, projectType: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm">
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Agricultural">Agricultural</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Deadline <span className="text-red-500">*</span></label>
              <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm" required />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Description <span className="text-red-500">*</span></label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
              placeholder="Client details, site info, requirements..." required />
          </div>

          {!isEditing && (
            <>
              {/* Quotation for Admin */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Quotation for Admin <span className="text-red-500">*</span>
                </label>
                <div className={`border-2 border-dashed ${file ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-orange-400'} rounded-xl p-4 text-center transition-colors`}>
                  <input type="file" onChange={onFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" className="hidden" id="admin-project-file" />
                  <label htmlFor="admin-project-file" className="cursor-pointer">
                    <Upload className={`w-7 h-7 mx-auto mb-2 ${file ? 'text-green-500' : 'text-slate-400'}`} />
                    {file ? (
                      <div><p className="text-sm text-green-600 font-semibold">✓ {filePreview}</p><p className="text-xs text-green-500">{(file.size/1024).toFixed(1)} KB — Click to change</p></div>
                    ) : (
                      <div><p className="text-sm text-slate-600 font-medium">Click to upload quotation for Admin</p><p className="text-xs text-slate-400">PDF, Word, Excel, Image • Max 50MB</p></div>
                    )}
                  </label>
                </div>
              </div>

              {/* Quotation for Planning Team */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Quotation for Planning Team <span className="text-slate-400 text-xs">(Optional)</span>
                </label>
                <div className={`border-2 border-dashed ${planningFile ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-400'} rounded-xl p-4 text-center transition-colors`}>
                  <input type="file" onChange={onPlanningFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" className="hidden" id="admin-planning-file" />
                  <label htmlFor="admin-planning-file" className="cursor-pointer">
                    <Upload className={`w-7 h-7 mx-auto mb-2 ${planningFile ? 'text-blue-500' : 'text-slate-400'}`} />
                    {planningFile ? (
                      <div><p className="text-sm text-blue-600 font-semibold">✓ {planningFilePreview}</p><p className="text-xs text-blue-500">{(planningFile.size/1024).toFixed(1)} KB — Click to change</p></div>
                    ) : (
                      <div><p className="text-sm text-slate-600 font-medium">Click to upload quotation for Planning Team</p><p className="text-xs text-slate-400">PDF, Word, Excel, Image • Max 50MB</p></div>
                    )}
                  </label>
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={isSubmitting}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : isEditing ? '✅ Update Project' : '✅ Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
}

// User Modal Component
function UserModal({ isEditing, form, setForm, onSubmit, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Edit User' : 'Add User'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Password {isEditing && '(leave blank to keep)'}
            </label>
            <input
              type="text"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
              required={!isEditing}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Role</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
            >
              <option value="selling">Selling</option>
              <option value="superadmin">Super Admin</option>
              <option value="planning">Planning</option>
              <option value="teamleader">Team Leader</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl"
          >
            {isEditing ? 'Update' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}

// BOQ Modal Component
function BOQModal({
  project, onClose, boqForm, setBoqForm, editingBoqItem, setEditingBoqItem,
  onAddBoq, onUpdateBoq, boqDocFile, setBoqDocFile, boqDocComment,
  setBoqDocComment, uploadingDoc, onUploadBoqDoc, editingDoc, setEditingDoc,
  editDocComment, setEditDocComment, onUpdateDocComment, onDeleteConfirm,
  uploadDocError, uploadDocSuccess, boqFileInputKey, boqFileInputRef
}: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">📋 BOQ — {project.name}</h2>
            <p className="text-sm text-slate-500">{project.city} | {project.capacity} | PKR {project.budget?.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        {/* BOQ Items Table */}
        {project.boq && project.boq.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-3 text-slate-600">#</th>
                  <th className="text-left py-3 px-3 text-slate-600">Description</th>
                  <th className="text-center py-3 px-3 text-slate-600">Unit</th>
                  <th className="text-center py-3 px-3 text-slate-600">Qty</th>
                  <th className="text-right py-3 px-3 text-slate-600">Rate (PKR)</th>
                  <th className="text-right py-3 px-3 text-slate-600">Amount (PKR)</th>
                  <th className="text-center py-3 px-3 text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {project.boq.map((item: any) => (
                  <BOQItemRow key={item.id} item={item} onEdit={() => {
                    setEditingBoqItem(item);
                    setBoqForm({ description: item.description, unit: item.unit, quantity: item.quantity, rate: item.rate });
                  }} onDelete={() => onDeleteConfirm({ type: 'boqItem', id: item.id, name: item.description })} />
                ))}
                <tr className="bg-purple-50 font-bold border-t-2 border-purple-200">
                  <td colSpan={5} className="py-3 px-3 text-right text-purple-700">Grand Total:</td>
                  <td className="py-3 px-3 text-right text-purple-700 text-base">
                    PKR {project.boq.reduce((sum: number, b: any) => sum + b.amount, 0).toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Add / Edit BOQ Item */}
        <div className={`p-4 rounded-xl border ${editingBoqItem ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-sm font-bold text-slate-700 mb-3">{editingBoqItem ? '✏️ Edit BOQ Item' : '➕ Add BOQ Item'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              placeholder="Description *"
              value={boqForm.description}
              onChange={e => setBoqForm({ ...boqForm, description: e.target.value })}
              className="col-span-2 sm:col-span-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            <select
              value={boqForm.unit}
              onChange={e => setBoqForm({ ...boqForm, unit: e.target.value })}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none"
            >
              <option value="pcs">Pcs</option><option value="set">Set</option><option value="meter">Meter</option>
              <option value="kg">Kg</option><option value="lot">Lot</option><option value="sqft">Sqft</option>
              <option value="watt">Watt</option><option value="kw">kW</option><option value="feet">Feet</option><option value="nos">Nos</option>
            </select>
            <input
              type="number" min="0.01" placeholder="Qty"
              value={boqForm.quantity}
              onChange={e => setBoqForm({ ...boqForm, quantity: Number(e.target.value) })}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none"
            />
            <input
              type="number" min="0" placeholder="Rate (PKR)"
              value={boqForm.rate}
              onChange={e => setBoqForm({ ...boqForm, rate: Number(e.target.value) })}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none"
            />
          </div>
          {boqForm.description && (
            <p className="text-xs text-purple-600 mt-2">Amount: PKR {(boqForm.quantity * boqForm.rate).toLocaleString()}</p>
          )}
          <div className="flex gap-2 mt-3">
            {editingBoqItem ? (
              <>
                <button onClick={() => onUpdateBoq(project)} disabled={!boqForm.description.trim()}
                  className="flex items-center gap-1 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" />Update
                </button>
                <button onClick={() => { setEditingBoqItem(null); setBoqForm({ description: '', unit: 'pcs', quantity: 1, rate: 0 }); }}
                  className="flex items-center gap-1 px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold">
                  <XCircle className="w-4 h-4" />Cancel
                </button>
              </>
            ) : (
              <button onClick={() => onAddBoq(project)} disabled={!boqForm.description.trim()}
                className="flex items-center gap-1 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50">
                <Plus className="w-4 h-4" />Add Item
              </button>
            )}
          </div>
        </div>

        {/* BOQ Documents */}
        <div className="border-t border-slate-200 pt-4">
          <h4 className="font-bold text-slate-700 mb-1">📁 BOQ Documents</h4>
          <p className="text-xs text-slate-500 mb-3">Upload Word, Excel, PDF or image files related to this BOQ.</p>

          {/* Existing Documents */}
          {project.boqDocuments && project.boqDocuments.length > 0 && (
            <div className="space-y-2 mb-4">
              {project.boqDocuments.map((doc: import('../types').BOQDocument) => (
                <div key={doc.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-700">{doc.name}</span>
                      <span className="text-xs text-slate-400">{(doc.size/1024).toFixed(1)} KB</span>
                    </div>
                    <p className="text-xs text-slate-500">{doc.uploadedByName||'Unknown'} • {new Date(doc.uploadedAt).toLocaleString()}</p>
                    {editingDoc?.id === doc.id ? (
                      <div className="mt-2 flex gap-2">
                        <input value={editDocComment} onChange={e => setEditDocComment(e.target.value)}
                          placeholder="Update comment..." className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none" />
                        <button onClick={() => onUpdateDocComment(project)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Save</button>
                        <button onClick={() => { setEditingDoc(null); setEditDocComment(''); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      </div>
                    ) : doc.comment && <p className="text-xs text-blue-600 mt-1">💬 {doc.comment}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.id && <button onClick={() => window.open(getFileDownloadUrl(doc.id), '_blank')} className="p-1.5 hover:bg-blue-100 rounded-lg" title="Download"><Download className="w-3.5 h-3.5 text-blue-600" /></button>}
                    <button onClick={() => { setEditingDoc(doc); setEditDocComment(doc.comment||''); }} className="p-1.5 hover:bg-amber-100 rounded-lg" title="Edit Comment"><Edit className="w-3.5 h-3.5 text-amber-600" /></button>
                    <button onClick={() => onDeleteConfirm({ type: 'boqDoc', id: doc.id, name: doc.name })} className="p-1.5 hover:bg-red-100 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload New Document */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">📤 Upload New Document</p>

            {/* Hidden input - triggered via ref */}
            <input
              ref={boqFileInputRef}
              key={boqFileInputKey}
              type="file"
              accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setBoqDocFile(f); }}
            />

            {/* Click button */}
            <button
              type="button"
              onClick={() => boqFileInputRef.current?.click()}
              className={`w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl transition-colors ${boqDocFile ? 'border-green-400 bg-green-50' : 'border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50'}`}
            >
              <Upload className={`w-5 h-5 flex-shrink-0 ${boqDocFile ? 'text-green-500' : 'text-blue-500'}`} />
              {boqDocFile ? (
                <div className="text-left">
                  <p className="text-sm font-medium text-green-700">{boqDocFile.name}</p>
                  <p className="text-xs text-green-600">{(boqDocFile.size/1024).toFixed(1)} KB — click to change</p>
                </div>
              ) : (
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-600">Click to select file</p>
                  <p className="text-xs text-slate-400">PDF, Word, Excel, Image (max 50MB)</p>
                </div>
              )}
            </button>

            <input
              value={boqDocComment}
              onChange={e => setBoqDocComment(e.target.value)}
              placeholder="Comment (optional)"
              className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {uploadDocError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{uploadDocError}</p>}
            {uploadDocSuccess && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{uploadDocSuccess}</p>}

            <button
              onClick={() => onUploadBoqDoc(project)}
              disabled={!boqDocFile || uploadingDoc}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingDoc ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Upload Document</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


function BOQItemRow({ item, onEdit, onDelete }: any) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-2.5 px-3 text-slate-500 text-sm">{item.id?.slice(-4) || '-'}</td>
      <td className="py-2.5 px-3 font-medium text-sm text-slate-800">{item.description}</td>
      <td className="py-2.5 px-3 text-center text-sm text-slate-600">{item.unit}</td>
      <td className="py-2.5 px-3 text-center text-sm text-slate-600">{item.quantity}</td>
      <td className="py-2.5 px-3 text-right text-sm text-slate-600">PKR {item.rate.toLocaleString()}</td>
      <td className="py-2.5 px-3 text-right text-sm font-semibold text-slate-800">PKR {item.amount.toLocaleString()}</td>
      <td className="py-2.5 px-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button onClick={onEdit} className="p-1.5 hover:bg-blue-100 rounded-lg" title="Edit"><Edit className="w-3.5 h-3.5 text-blue-600" /></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-100 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
        </div>
      </td>
    </tr>
  );
}

// Reject Modal Component
function RejectModal({ projectId, reason, setReason, error, onReject, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-xl font-bold text-slate-800">Reject Project</h3>
        {error && (
          <div className="text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection (required)"
          rows={4}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => onReject(projectId)}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirm Modal Component
function DeleteConfirmModal({ deleteConfirm, onConfirm, onCancel }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Confirm Delete</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {deleteConfirm.type === 'project' ? '🗂️ Project' : deleteConfirm.type === 'user' ? '👤 User' : deleteConfirm.type === 'boqItem' ? '📊 BOQ Item' : '📁 Document'}:
              <strong className="text-slate-700"> {deleteConfirm.name}</strong>
            </p>
            {deleteConfirm.type === 'project' && (
              <p className="text-xs text-red-500 mt-1">All steps, BOQ, files & data will be deleted!</p>
            )}
          </div>
        </div>
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          ⚠️ This action cannot be undone!
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Yes, Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}