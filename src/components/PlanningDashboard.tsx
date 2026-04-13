import { useState, useEffect, useRef } from 'react';
import { UserPlus, CheckCircle, XCircle, Eye, X, Download, ClipboardList, BarChart3, Bell, Edit, Plus, Trash2, Loader2, AlertTriangle, Upload, MessageSquare, Search, Users, Calendar } from 'lucide-react';
import { User, Project, BOQItem, BOQDocument, PROJECT_STEPS } from '../types';
import {
  fetchProjectsAsync, fetchProjectByIdAsync, fetchLeadersAsync, fetchNotificationsAsync,
  assignProjectAsync, approveStepFileAsync,
  addBoqAsync, updateBoqAsync, removeBoqAsync,
  uploadBoqDocAsync, updateBoqDocAsync, removeBoqDocAsync,
  getFileDownloadUrl,
  viewFileInBrowser,
  markNotificationReadAsync,
  markAllNotificationsReadAsync,
  setStepDeadlineAsync,
} from '../store';
import { generatePlanningPDF, viewProjectPDF, generateAllProjectsExcel, generateProgressPDF } from '../utils/reports';

interface Props { user: User; }
type Tab = 'assign' | 'monitor' | 'approvals' | 'boq' | 'notifications' | 'team';

export function PlanningDashboard({ user: _user }: Props) {
  const [tab, setTab] = useState<Tab>('assign');
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaders, setLeaders] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<import('../types').Notification[]>([]);
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const [editBoqProject, setEditBoqProject] = useState<Project | null>(null);
  const [boqForm, setBoqForm] = useState({ description: '', unit: 'pcs', quantity: 1, rate: 0 });
  const [editingBoqItem, setEditingBoqItem] = useState<BOQItem | null>(null);

  // BOQ Document states
  const [boqDocFile, setBoqDocFile] = useState<File | null>(null);
  const [boqDocComment, setBoqDocComment] = useState('');
  const [editingDoc, setEditingDoc] = useState<BOQDocument | null>(null);
  const [editDocComment, setEditDocComment] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState('');
  const [uploadDocSuccess, setUploadDocSuccess] = useState('');
  const [boqFileInputKey, setBoqFileInputKey] = useState(0);
  const boqFileInputRef = useRef<HTMLInputElement>(null);
  const [boqAddError, setBoqAddError] = useState('');
  const [boqAddSuccess, setBoqAddSuccess] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'boqItem' | 'boqDoc'; id: string; name: string } | null>(null);

  // Assign tab filter + pagination
  const [assignFilter, setAssignFilter] = useState<'unassigned' | 'assigned' | 'completed' | 'all'>('unassigned');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignPage, setAssignPage] = useState(1);
  const ASSIGN_PAGE_SIZE = 5;

  // Assign modal (with step deadlines)
  const [assignModal, setAssignModal] = useState<{ project: Project; leader: User } | null>(null);
  const [stepDeadlines, setStepDeadlines] = useState<Record<number, string>>({});
  const [assigning, setAssigning] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ projectId: string; stepNum: number; fileId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [p, l, n] = await Promise.all([fetchProjectsAsync(), fetchLeadersAsync(), fetchNotificationsAsync('planning')]);
    setProjects(p); setLeaders(l); setNotifications(n);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const approvedProjects = projects.filter(p => p.status === 'approved' && !p.assignedLeader);
  const assignedProjects = projects.filter(p => p.assignedLeader);
  const allActiveProjects = projects.filter(p => p.status !== 'new' && p.status !== 'rejected');
  const projectsWithBoq = projects.filter(p => p.status !== 'rejected');

  const pendingApprovals = projects.flatMap(p =>
    (p.steps || []).filter(s => s.files && s.files.some(f => f.approvalStatus === 'pending')).map(s => ({ project: p, step: s }))
  );

  const refreshBoqProject = async (projectId: string) => {
    await loadData();
    const updated = await fetchProjectByIdAsync(projectId);
    if (updated) setEditBoqProject(updated);
  };

  const openAssignModal = (project: Project, leader: User) => {
    setAssignModal({ project, leader });
    setStepDeadlines({});
  };

  const handleConfirmAssign = async () => {
    if (!assignModal) return;
    setAssigning(true);
    await assignProjectAsync(assignModal.project.id, assignModal.leader.id);
    // Set deadlines for steps that have a date entered
    const deadlineEntries = Object.entries(stepDeadlines).filter(([, d]) => d);
    for (const [stepNum, deadline] of deadlineEntries) {
      await setStepDeadlineAsync(assignModal.project.id, parseInt(stepNum), deadline);
    }
    setAssignModal(null);
    setStepDeadlines({});
    setAssigning(false);
    await loadData();
  };

  const handleApproveStepFile = async (fileId: string) => {
    if (!confirm('APPROVE this file? This action is final.')) return;
    await approveStepFileAsync(fileId, true, 'Approved by Planning');
    await loadData();
  };

  const handleRejectStepFile = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) { setRejectError('⚠️ Reject reason is MANDATORY!'); return; }
    await approveStepFileAsync(rejectModal.fileId, false, rejectReason);
    await loadData();
    setRejectModal(null); setRejectReason(''); setRejectError('');
  };

  // BOQ Item handlers
  const handleAddBoq = async (project: Project) => {
    if (!boqForm.description.trim()) return;
    if (boqForm.quantity <= 0) { setBoqAddError('❌ Quantity must be > 0'); return; }
    setBoqAddError('');
    const result = await addBoqAsync(project.id, boqForm);
    if (result.success) {
      setBoqAddSuccess('✅ Item added!'); setTimeout(() => setBoqAddSuccess(''), 2000);
      setBoqForm({ description: '', unit: 'pcs', quantity: 1, rate: 0 });
      await refreshBoqProject(project.id);
    } else { setBoqAddError('❌ ' + (result.message || 'Failed to add item')); }
  };

  const handleUpdateBoq = async (project: Project) => {
    if (!editingBoqItem || !boqForm.description.trim()) return;
    setBoqAddError('');
    const result = await updateBoqAsync(editingBoqItem.id, boqForm);
    if (result.success) {
      setBoqAddSuccess('✅ Updated!'); setTimeout(() => setBoqAddSuccess(''), 2000);
      setEditingBoqItem(null);
      setBoqForm({ description: '', unit: 'pcs', quantity: 1, rate: 0 });
      await refreshBoqProject(project.id);
    } else { setBoqAddError('❌ ' + (result.message || 'Failed to update')); }
  };

  const confirmDeleteBoqItem = (item: BOQItem) => {
    setDeleteConfirm({ type: 'boqItem', id: item.id, name: item.description });
  };

  const confirmDeleteBoqDoc = (doc: BOQDocument) => {
    setDeleteConfirm({ type: 'boqDoc', id: doc.id, name: doc.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !editBoqProject) return;
    if (deleteConfirm.type === 'boqItem') {
      await removeBoqAsync(deleteConfirm.id);
    } else {
      await removeBoqDocAsync(deleteConfirm.id);
    }
    setDeleteConfirm(null);
    await refreshBoqProject(editBoqProject.id);
  };

  // BOQ Document handlers
  const handleUploadDoc = async (project: Project) => {
    if (!boqDocFile) { setUploadDocError('❌ Please select a file first'); return; }
    setUploadingDoc(true); setUploadDocError(''); setUploadDocSuccess('');
    const result = await uploadBoqDocAsync(project.id, boqDocFile, boqDocComment);
    setUploadingDoc(false);
    if (result.success) {
      setBoqDocFile(null); setBoqDocComment('');
      setBoqFileInputKey(k => k + 1);
      setUploadDocSuccess('✅ Document uploaded!');
      setTimeout(() => setUploadDocSuccess(''), 3000);
      await refreshBoqProject(project.id);
    } else { setUploadDocError('❌ ' + (result.message || 'Upload failed')); }
  };

  const handleUpdateDocComment = async (project: Project) => {
    if (!editingDoc) return;
    await updateBoqDocAsync(editingDoc.id, editDocComment);
    setEditingDoc(null); setEditDocComment('');
    await refreshBoqProject(project.id);
  };

  const startEditBoqItem = (item: BOQItem) => {
    setEditingBoqItem(item);
    setBoqForm({ description: item.description, unit: item.unit, quantity: item.quantity, rate: item.rate });
  };

  const cancelEditBoqItem = () => {
    setEditingBoqItem(null);
    setBoqForm({ description: '', unit: 'pcs', quantity: 1, rate: 0 });
    setBoqAddError(''); setBoqAddSuccess('');
  };

  const statusColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700',
    assigned: 'bg-purple-100 text-purple-700', accepted: 'bg-indigo-100 text-indigo-700',
    in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /><span className="ml-3 text-slate-500">Loading...</span></div>;

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-slate-800">📋 Planning Team</h2><p className="text-slate-500">Nominate teams, BOQ management, approvals</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Unassigned', count: approvedProjects.length, color: 'bg-amber-500' },
          { label: 'Assigned', count: assignedProjects.length, color: 'bg-purple-500' },
          { label: 'Pending Approvals', count: pendingApprovals.length, color: 'bg-red-500' },
          { label: 'BOQ Projects', count: projectsWithBoq.filter(p => p.boq?.length > 0).length, color: 'bg-indigo-500' },
          { label: 'All Active', count: allActiveProjects.length, color: 'bg-blue-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-white font-bold text-lg mb-2`}>{s.count}</div>
            <p className="text-sm text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {([
          { key: 'assign' as const, label: 'Team Nominate', icon: UserPlus },
          { key: 'monitor' as const, label: 'Monitor', icon: BarChart3 },
          { key: 'approvals' as const, label: 'Approvals', icon: ClipboardList, badge: pendingApprovals.length },
          { key: 'boq' as const, label: 'BOQ', icon: Edit },
          { key: 'team' as const, label: 'Team View', icon: Users },
          { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: notifications.filter(n => !n.read).length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span>
            {'badge' in t && (t.badge ?? 0) > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Team Nominate */}
      {tab === 'assign' && (() => {
        const allForAssign = projects.filter(p => p.status !== 'new' && p.status !== 'rejected');
        const filterMap: Record<string, Project[]> = {
          unassigned: allForAssign.filter(p => p.status === 'approved' && !p.assignedLeader),
          assigned:   allForAssign.filter(p => p.assignedLeader && p.status !== 'completed'),
          completed:  allForAssign.filter(p => p.status === 'completed'),
          all:        allForAssign,
        };
        const searchFiltered = (filterMap[assignFilter] || []).filter(p =>
          p.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
          p.city.toLowerCase().includes(assignSearch.toLowerCase()) ||
          (p.assignedTeam || '').toLowerCase().includes(assignSearch.toLowerCase())
        );
        const totalPages = Math.ceil(searchFiltered.length / ASSIGN_PAGE_SIZE);
        const paginated = searchFiltered.slice((assignPage - 1) * ASSIGN_PAGE_SIZE, assignPage * ASSIGN_PAGE_SIZE);

        return (
          <div className="space-y-4">
            <div className="flex gap-2 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" value={assignSearch}
                  onChange={e => { setAssignSearch(e.target.value); setAssignPage(1); }}
                  placeholder="Search project, city, leader..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
                {([
                  { key: 'unassigned' as const, label: `Unassigned (${filterMap.unassigned.length})` },
                  { key: 'assigned'   as const, label: `Assigned (${filterMap.assigned.length})` },
                  { key: 'completed'  as const, label: `Done (${filterMap.completed.length})` },
                  { key: 'all'        as const, label: `All (${filterMap.all.length})` },
                ]).map(f => (
                  <button key={f.key} onClick={() => { setAssignFilter(f.key); setAssignPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${assignFilter === f.key ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {paginated.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border">
                <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{assignSearch ? 'No projects match your search' : 'No projects in this category'}</p>
              </div>
            ) : paginated.map(p => {
              const done = p.steps?.filter(s => ['completed','approved'].includes(s.status)).length || 0;
              const total = p.steps?.length || 16;
              const pct = Math.round((done/total)*100);
              return (
                <div key={p.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-slate-800">{p.name}</h3>
                        {p.workOrderNumber && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono">{p.workOrderNumber}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{p.status.replace('_',' ').toUpperCase()}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>📍 {p.city}</span><span>⚡ {p.capacity}</span>
                        <span>🏠 {p.projectType}</span><span>💰 PKR {p.budget.toLocaleString()}</span>
                        <span className={`font-medium ${Math.ceil((new Date(p.deadline).getTime()-Date.now())/86400000) <= 7 ? 'text-red-600' : 'text-slate-500'}`}>
                          📅 {new Date(p.deadline).toLocaleDateString('en-PK')} ({Math.ceil((new Date(p.deadline).getTime()-Date.now())/86400000)}d left)
                        </span>
                        {p.assignedTeam && <span className="text-purple-600 font-medium">👷 {p.assignedTeam}</span>}
                      </div>
                      {p.assignedLeader && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{done}/{total} steps ({pct}%)</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setViewProject(p)} className="p-2 hover:bg-orange-50 rounded-lg flex-shrink-0"><Eye className="w-4 h-4 text-orange-600" /></button>
                  </div>
                  {p.description && (
                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-slate-500 font-medium mb-0.5">📝 Description</p>
                      <p className="text-xs text-slate-700">{p.description.substring(0, 150)}{p.description.length > 150 ? '...' : ''}</p>
                    </div>
                  )}
                  {p.quotationPlanningFile?.id ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 flex items-center justify-between">
                      <div><p className="text-xs font-medium text-purple-700">📐 Planning Quotation</p><p className="text-xs text-purple-600">{p.quotationPlanningFile.name}</p></div>
                      <div className="flex gap-1">
                        <button onClick={() => viewFileInBrowser(p.quotationPlanningFile!.id!, p.quotationPlanningFile!.name)} className="p-1.5 hover:bg-purple-100 rounded-lg"><Eye className="w-3.5 h-3.5 text-purple-600" /></button>
                        <button onClick={() => window.open(getFileDownloadUrl(p.quotationPlanningFile!.id!), '_blank')} className="p-1.5 hover:bg-blue-100 rounded-lg"><Download className="w-3.5 h-3.5 text-blue-600" /></button>
                      </div>
                    </div>
                  ) : <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">⚠️ No planning quotation uploaded</p>}
                  {p.status === 'approved' && !p.assignedLeader && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-2 block">👷 Assign Team Leader:</label>
                      <div className="flex gap-2 flex-wrap">
                        {leaders.map(l => (
                          <button key={l.id} onClick={() => openAssignModal(p, l)} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 border border-purple-200">
                            <UserPlus className="w-3.5 h-3.5 inline mr-1" />{l.name}
                          </button>
                        ))}
                        {leaders.length === 0 && <p className="text-sm text-red-500">No team leaders available</p>}
                      </div>
                    </div>
                  )}
                  {p.assignedLeader && (
                    <div className="flex gap-2">
                      <button onClick={() => viewProjectPDF(p)} className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100"><Eye className="w-3.5 h-3.5" />View PDF</button>
                      <button onClick={() => generatePlanningPDF(p)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100"><Download className="w-3.5 h-3.5" />Planning PDF</button>
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <button onClick={() => setAssignPage(pg => Math.max(1, pg-1))} disabled={assignPage === 1} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600 text-sm">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setAssignPage(pg)} className={`w-8 h-8 rounded-lg text-sm font-medium ${assignPage === pg ? 'bg-orange-500 text-white' : 'border border-slate-200 hover:bg-slate-100 text-slate-600'}`}>{pg}</button>
                ))}
                <button onClick={() => setAssignPage(pg => Math.min(totalPages, pg+1))} disabled={assignPage === totalPages} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600 text-sm">›</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Monitor */}
      {tab === 'monitor' && (
        <MonitorTab
          allActiveProjects={allActiveProjects}
          statusColor={statusColor}
          viewProjectPDF={viewProjectPDF}
          generatePlanningPDF={generatePlanningPDF}
          generateAllProjectsExcel={generateAllProjectsExcel}
          generateProgressPDF={generateProgressPDF}
        />
      )}

      {/* Step Approvals */}
      {tab === 'approvals' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border"><CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No pending approvals</p></div>}
          {pendingApprovals.map(({ project: p, step: s }) => (
            <div key={`${p.id}-${s.step}`} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
              <div><h3 className="font-bold text-slate-800">{p.name} — Step {s.step}: {s.name}</h3><p className="text-sm text-slate-500">Leader: {p.assignedTeam}</p></div>
              {s.description && <p className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">Notes: {s.description}</p>}
              {s.files.filter(f => f.approvalStatus === 'pending').map(f => (
                <div key={f.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">{f.name}</p>
                    <p className="text-xs text-slate-500">{(f.size/1024).toFixed(1)} KB • {new Date(f.uploadedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.id && <button onClick={() => window.open(getFileDownloadUrl(f.id), '_blank')} className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg" title="Download"><Download className="w-4 h-4 text-blue-600" /></button>}
                    {f.id && <button onClick={() => viewFileInBrowser(f.id, f.name)} className="p-2 bg-orange-50 hover:bg-orange-100 rounded-lg" title="View Document"><Eye className="w-4 h-4 text-orange-600" /></button>}
                    <button onClick={() => handleApproveStepFile(f.id)} className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100"><CheckCircle className="w-3.5 h-3.5" />Approve</button>
                    <button onClick={() => { setRejectModal({ projectId: p.id, stepNum: s.step, fileId: f.id }); setRejectReason(''); setRejectError(''); }}
                      className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"><XCircle className="w-3.5 h-3.5" />Reject</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* BOQ Management */}
      {tab === 'boq' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-700">📋 Add BOQ items manually OR upload Word/Excel/PDF documents. Both Admin and Planning can manage BOQ.</div>
          {projectsWithBoq.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{p.status.replace('_',' ').toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-slate-500">{p.city} | {p.capacity}</p>
                  {p.boq?.length > 0 ? <p className="text-xs text-purple-600 mt-1">📊 {p.boq.length} items | PKR {p.boq.reduce((s, b) => s+b.amount, 0).toLocaleString()}</p> : <p className="text-xs text-slate-400 mt-1">No BOQ items yet</p>}
                  {(p.boqDocuments?.length ?? 0) > 0 && <p className="text-xs text-blue-600 mt-0.5">📎 {p.boqDocuments!.length} document(s)</p>}
                </div>
                <button onClick={() => { setEditBoqProject(p); cancelEditBoqItem(); }} className="flex items-center gap-1 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 border border-purple-200 self-start">
                  <Edit className="w-3.5 h-3.5" />{p.boq?.length > 0 ? 'Manage BOQ' : 'Add BOQ'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Overview */}
      {tab === 'team' && (
        <TeamOverviewTab
          projects={projects}
          leaders={leaders}
          statusColor={statusColor}
          onViewProject={setViewProject}
        />
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="font-semibold text-slate-700">Alerts</span>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {notifications.filter(n => !n.read).length} new
                </span>
              )}
            </div>
            {notifications.filter(n => !n.read).length > 0 && (
              <button
                onClick={async () => { await markAllNotificationsReadAsync(); await loadData(); }}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium px-3 py-1.5 bg-purple-50 rounded-lg hover:bg-purple-100 transition-all">
                ✓ Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0
            ? <div className="text-center py-12 bg-white rounded-2xl border"><Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No notifications</p></div>
            : <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                {notifications.filter(n => !n.read).map(n => {
                  const relatedProject = projects.find(p => p.id === n.projectId);
                  return (
                    <div key={n.id} className="p-4 bg-purple-50 flex items-start gap-3">
                      <span className="text-lg mt-0.5">
                        {n.type === 'approval_needed' ? '✅' : n.type === 'deadline_warning' ? '⏰' : '🔔'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                        {relatedProject?.quotationPlanningFile?.id && (
                          <button
                            onClick={() => window.open(getFileDownloadUrl(relatedProject.quotationPlanningFile!.id!), '_blank')}
                            className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 bg-white border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50 font-medium">
                            <Download className="w-3.5 h-3.5" />
                            Download Planning Quotation: {relatedProject.quotationPlanningFile.name}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={async () => { await markNotificationReadAsync(n.id); await loadData(); }}
                        className="text-xs text-slate-400 hover:text-green-600 px-2 py-1 rounded hover:bg-green-50 flex-shrink-0 transition-colors"
                        title="Mark as read">✓
                      </button>
                    </div>
                  );
                })}
                {notifications.filter(n => n.read).length > 0 && (
                  <>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <div className="px-4 py-2 bg-slate-50">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Previously read</p>
                      </div>
                    )}
                    {notifications.filter(n => n.read).map(n => (
                      <div key={n.id} className="p-4 flex items-start gap-3 opacity-50">
                        <span className="text-lg mt-0.5">
                          {n.type === 'approval_needed' ? '✅' : n.type === 'deadline_warning' ? '⏰' : '🔔'}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-slate-600">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
          }
        </div>
      )}

      {/* REJECT FILE MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-red-500" /><h3 className="text-xl font-bold text-slate-800">Reject — Reason Required</h3></div>
            {rejectError && <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm"><AlertTriangle className="w-4 h-4" />{rejectError}</div>}
            <textarea value={rejectReason} onChange={e => { setRejectReason(e.target.value); setRejectError(''); }}
              rows={4} placeholder="Describe rejection reason... (MANDATORY)"
              className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-3">
              <button onClick={handleRejectStepFile} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 flex items-center justify-center gap-2"><XCircle className="w-4 h-4" />Confirm Reject</button>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); setRejectError(''); }} className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN WITH DEADLINES MODAL */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">👷 Assign Team Leader</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  <strong>{assignModal.leader.name}</strong> → <strong>{assignModal.project.name}</strong>
                </p>
              </div>
              <button onClick={() => setAssignModal(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-700">
              <Calendar className="w-4 h-4 inline mr-1" />
              Har step ki deadline optional hai — jo chahein set karo, baaki baad mein bhi set ho sakti hain
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 mb-1">📋 Step Deadlines (Optional)</p>
              {PROJECT_STEPS.map(s => (
                <div key={s.step} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${s.type === 'sub' ? 'bg-slate-50 border-slate-100 ml-4' : 'bg-white border-slate-200'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.type === 'sub' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                    {s.step}
                  </div>
                  <span className="flex-1 text-sm text-slate-700 font-medium">{s.name}</span>
                  <input
                    type="date"
                    value={stepDeadlines[s.step] || ''}
                    onChange={e => setStepDeadlines(prev => ({ ...prev, [s.step]: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 w-36 flex-shrink-0"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConfirmAssign}
                disabled={assigning}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {assigning ? 'Assigning...' : 'Confirm Assign'}
              </button>
              <button onClick={() => setAssignModal(null)} className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800">Confirm Delete</h3>
                <p className="text-sm text-slate-500">{deleteConfirm.type === 'boqItem' ? 'BOQ Item' : 'Document'}: <strong>{deleteConfirm.name}</strong></p>
              </div>
            </div>
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠️ This action cannot be undone!</p>
            <div className="flex gap-3">
              <button onClick={handleConfirmDelete} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600">Yes, Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* BOQ MODAL */}
      {editBoqProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-slate-800">📋 BOQ — {editBoqProject.name}</h3><p className="text-sm text-slate-500">{editBoqProject.city} | {editBoqProject.capacity}</p></div>
              <button onClick={() => { setEditBoqProject(null); cancelEditBoqItem(); }} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* BOQ Items Table */}
            {editBoqProject.boq?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-2 px-2">#</th><th className="text-left py-2 px-2">Description</th><th className="text-center py-2 px-2">Unit</th>
                    <th className="text-center py-2 px-2">Qty</th><th className="text-right py-2 px-2">Rate</th><th className="text-right py-2 px-2">Amount</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr></thead>
                  <tbody>
                    {editBoqProject.boq.map((b, idx) => (
                      <tr key={b.id} className={`border-b border-slate-50 ${editingBoqItem?.id === b.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <td className="py-2 px-2 text-slate-500">{idx+1}</td>
                        <td className="py-2 px-2 font-medium">{b.description}</td>
                        <td className="py-2 px-2 text-center">{b.unit}</td>
                        <td className="py-2 px-2 text-center">{b.quantity}</td>
                        <td className="py-2 px-2 text-right">PKR {b.rate.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-semibold">PKR {b.amount.toLocaleString()}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEditBoqItem(b)} className="p-1.5 hover:bg-blue-100 rounded-lg" title="Edit"><Edit className="w-3.5 h-3.5 text-blue-600" /></button>
                            <button onClick={() => confirmDeleteBoqItem(b)} className="p-1.5 hover:bg-red-100 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-purple-50">
                      <td colSpan={5} className="py-3 px-2 text-right text-purple-700">Grand Total:</td>
                      <td className="py-3 px-2 text-right text-purple-700 text-base">PKR {editBoqProject.boq.reduce((s, b) => s+b.amount, 0).toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Add/Edit BOQ Item Form */}
            <div className={`p-4 rounded-xl border ${editingBoqItem ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-sm font-bold text-slate-700 mb-3">{editingBoqItem ? '✏️ Edit BOQ Item' : '➕ Add BOQ Item'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input placeholder="Description *" value={boqForm.description} onChange={e => setBoqForm({...boqForm, description: e.target.value})} className="col-span-2 sm:col-span-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                <select value={boqForm.unit} onChange={e => setBoqForm({...boqForm, unit: e.target.value})} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                  <option value="pcs">Pcs</option><option value="set">Set</option><option value="meter">Meter</option><option value="kg">Kg</option><option value="lot">Lot</option><option value="sqft">Sqft</option><option value="watt">Watt</option><option value="kw">kW</option><option value="feet">Feet</option><option value="nos">Nos</option>
                </select>
                <input type="number" placeholder="Qty" value={boqForm.quantity} onChange={e => setBoqForm({...boqForm, quantity: Number(e.target.value)})} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white" />
                <input type="number" placeholder="Rate (PKR)" value={boqForm.rate} onChange={e => setBoqForm({...boqForm, rate: Number(e.target.value)})} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white" />
              </div>
              {boqForm.description && <p className="text-xs text-purple-600 mt-2">Amount: PKR {(boqForm.quantity * boqForm.rate).toLocaleString()}</p>}
              {boqAddError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">{boqAddError}</p>}
              {boqAddSuccess && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg mt-2">{boqAddSuccess}</p>}
              <div className="flex gap-2 mt-3">
                {editingBoqItem ? (
                  <>
                    <button onClick={() => handleUpdateBoq(editBoqProject)} disabled={!boqForm.description.trim()} className="flex items-center gap-1 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"><CheckCircle className="w-4 h-4" />Update</button>
                    <button onClick={cancelEditBoqItem} className="flex items-center gap-1 px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold"><XCircle className="w-4 h-4" />Cancel</button>
                  </>
                ) : (
                  <button onClick={() => handleAddBoq(editBoqProject)} disabled={!boqForm.description.trim()} className="flex items-center gap-1 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50"><Plus className="w-4 h-4" />Add Item</button>
                )}
              </div>
            </div>

            {/* BOQ Documents */}
            {/* <div className="border-t border-slate-200 pt-4">
              <h4 className="font-bold text-slate-700 mb-3">📁 BOQ Documents (Word/Excel/PDF)</h4>
              <p className="text-xs text-slate-500 mb-3">Both Planning and Admin can upload, comment, edit or delete documents. Anyone can download.</p> */}

              {/* Existing Documents */}
              {/* {editBoqProject.boqDocuments && editBoqProject.boqDocuments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {editBoqProject.boqDocuments.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-700">{doc.name}</span>
                          <span className="text-xs text-slate-400">{(doc.size/1024).toFixed(1)} KB</span>
                        </div>
                        <p className="text-xs text-slate-500">{doc.uploadedByName || 'Unknown'} • {new Date(doc.uploadedAt).toLocaleString()}</p>
                        {editingDoc?.id === doc.id ? (
                          <div className="mt-2 flex gap-2">
                            <input value={editDocComment} onChange={e => setEditDocComment(e.target.value)} placeholder="Update comment..." className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => handleUpdateDocComment(editBoqProject)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
                            <button onClick={() => { setEditingDoc(null); setEditDocComment(''); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                          </div>
                        ) : (
                          doc.comment && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{doc.comment}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {doc.id && <button onClick={() => window.open(getFileDownloadUrl(doc.id), '_blank')} className="p-1.5 hover:bg-blue-100 rounded-lg" title="Download"><Download className="w-3.5 h-3.5 text-blue-600" /></button>}
                        <button onClick={() => { setEditingDoc(doc); setEditDocComment(doc.comment || ''); }} className="p-1.5 hover:bg-amber-100 rounded-lg" title="Edit Comment"><Edit className="w-3.5 h-3.5 text-amber-600" /></button>
                        <button onClick={() => confirmDeleteBoqDoc(doc)} className="p-1.5 hover:bg-red-100 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )} */}

              {/* Upload New Document */}
              {/* <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-700 mb-3">📤 Upload New Document</p>
                <div className="space-y-3">
                  <div>
                    <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" className="hidden" id="boq-doc-upload"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setBoqDocFile(f); }} />
                    <label htmlFor="boq-doc-upload" className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${boqDocFile ? 'border-green-400 bg-green-50' : 'border-blue-300 hover:border-blue-400'}`}>
                      <Upload className={`w-5 h-5 ${boqDocFile ? 'text-green-500' : 'text-blue-500'}`} />
                      {boqDocFile ? <div><p className="text-sm font-medium text-green-700">{boqDocFile.name}</p><p className="text-xs text-green-600">{(boqDocFile.size/1024).toFixed(1)} KB</p></div>
                        : <div><p className="text-sm font-medium text-slate-600">Click to select file</p><p className="text-xs text-slate-400">PDF, Word, Excel, Image</p></div>}
                    </label>
                  </div>
                  <input value={boqDocComment} onChange={e => setBoqDocComment(e.target.value)} placeholder="Add comment (optional)..." className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => handleUploadDoc(editBoqProject)} disabled={!boqDocFile || uploadingDoc} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {uploadingDoc ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Upload Document</>}
                  </button>
                </div>
              </div>
            </div> */}
            {/* BOQ Documents */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-bold text-slate-700 mb-1">📁 BOQ Documents</h4>
              <p className="text-xs text-slate-500 mb-3">Planning and Admin can upload Word, Excel, PDF or images.</p>

              {/* Existing Documents */}
              {editBoqProject.boqDocuments && editBoqProject.boqDocuments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {editBoqProject.boqDocuments.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-700">{doc.name}</span>
                          <span className="text-xs text-slate-400">{(doc.size/1024).toFixed(1)} KB</span>
                        </div>
                        <p className="text-xs text-slate-500">{doc.uploadedByName || 'Unknown'} • {new Date(doc.uploadedAt).toLocaleString()}</p>
                        {editingDoc?.id === doc.id ? (
                          <div className="mt-2 flex gap-2">
                            <input value={editDocComment} onChange={e => setEditDocComment(e.target.value)} placeholder="Update comment..." className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => handleUpdateDocComment(editBoqProject)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
                            <button onClick={() => { setEditingDoc(null); setEditDocComment(''); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                          </div>
                        ) : (
                          doc.comment && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{doc.comment}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {doc.id && <button onClick={() => window.open(getFileDownloadUrl(doc.id), '_blank')} className="p-1.5 hover:bg-blue-100 rounded-lg" title="Download"><Download className="w-3.5 h-3.5 text-blue-600" /></button>}
                        <button onClick={() => { setEditingDoc(doc); setEditDocComment(doc.comment || ''); }} className="p-1.5 hover:bg-amber-100 rounded-lg" title="Edit Comment"><Edit className="w-3.5 h-3.5 text-amber-600" /></button>
                        <button onClick={() => confirmDeleteBoqDoc(doc)} className="p-1.5 hover:bg-red-100 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload New Document */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-slate-700">📤 Upload New Document</p>

                <input
                  ref={boqFileInputRef}
                  key={boqFileInputKey}
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setBoqDocFile(f); setUploadDocError(''); } }}
                />

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
                  placeholder="Add comment (optional)..."
                  className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {uploadDocError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{uploadDocError}</p>}
                {uploadDocSuccess && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{uploadDocSuccess}</p>}

                <button
                  onClick={() => handleUploadDoc(editBoqProject)}
                  disabled={!boqDocFile || uploadingDoc}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingDoc ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Upload Document</>}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* View Project Modal */}
      {viewProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{viewProject.name}</h3>
              <button onClick={() => setViewProject(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Status + WO */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[viewProject.status]}`}>{viewProject.status.replace('_',' ').toUpperCase()}</span>
              {viewProject.workOrderNumber && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono">{viewProject.workOrderNumber}</span>}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-xl p-4">
              <div><p className="text-slate-500 text-xs">Location</p><p className="font-medium">{viewProject.location}</p></div>
              <div><p className="text-slate-500 text-xs">City</p><p className="font-medium">{viewProject.city}</p></div>
              <div><p className="text-slate-500 text-xs">Capacity</p><p className="font-medium">{viewProject.capacity}</p></div>
              <div><p className="text-slate-500 text-xs">Type</p><p className="font-medium">{viewProject.projectType}</p></div>
              <div><p className="text-slate-500 text-xs">Budget</p><p className="font-medium text-green-700">PKR {viewProject.budget.toLocaleString()}</p></div>
              <div><p className="text-slate-500 text-xs">Deadline</p>
                <p className={`font-medium ${Math.ceil((new Date(viewProject.deadline).getTime()-Date.now())/86400000) < 0 ? 'text-red-600' : Math.ceil((new Date(viewProject.deadline).getTime()-Date.now())/86400000) <= 7 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {new Date(viewProject.deadline).toLocaleDateString('en-PK')}
                  {' '}({Math.ceil((new Date(viewProject.deadline).getTime()-Date.now())/86400000) < 0
                    ? `${Math.abs(Math.ceil((new Date(viewProject.deadline).getTime()-Date.now())/86400000))}d overdue`
                    : `${Math.ceil((new Date(viewProject.deadline).getTime()-Date.now())/86400000)}d left`})
                </p>
              </div>
              {viewProject.assignedTeam && <div><p className="text-slate-500 text-xs">Team Leader</p><p className="font-medium">{viewProject.assignedTeam}</p></div>}
            </div>

            {/* Description */}
            {viewProject.description && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1 font-medium">📝 Description</p>
                <p className="text-sm text-slate-700">{viewProject.description}</p>
              </div>
            )}

            {/* Planning Quotation */}
            {viewProject.quotationPlanningFile?.id ? (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-medium text-purple-700 mb-2">📐 Quotation for Planning Team</p>
                <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{viewProject.quotationPlanningFile.name}</p>
                    <p className="text-xs text-slate-500">{viewProject.quotationPlanningFile.size ? `${(viewProject.quotationPlanningFile.size/1024).toFixed(1)} KB` : ''}</p>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <button onClick={() => viewFileInBrowser(viewProject.quotationPlanningFile!.id!, viewProject.quotationPlanningFile!.name)}
                      className="p-2 hover:bg-purple-100 rounded-lg" title="View">
                      <Eye className="w-4 h-4 text-purple-600" />
                    </button>
                    <button onClick={() => window.open(getFileDownloadUrl(viewProject.quotationPlanningFile!.id!), '_blank')}
                      className="p-2 hover:bg-blue-100 rounded-lg" title="Download">
                      <Download className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">📐 No Planning Quotation uploaded for this project</p>
              </div>
            )}

            {/* PDF Actions */}
            <div className="flex gap-2">
              <button onClick={() => viewProjectPDF(viewProject)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-100"><Eye className="w-4 h-4" />View PDF</button>
              <button onClick={() => generatePlanningPDF(viewProject)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-600 rounded-xl text-sm font-medium hover:bg-green-100"><Download className="w-4 h-4" />Planning PDF</button>
            </div>

            {/* Steps Progress with Deadline Setting */}
            {viewProject.steps && viewProject.steps.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Project Steps & Deadlines</p>
                <div className="space-y-2">
                  {viewProject.steps.map(s => {
                    const dl = s.stepDeadline;
                    const daysLeft = dl ? Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000) : null;
                    const isLate = s.completedAt && dl && new Date(s.completedAt) > new Date(dl);
                    return (
                      <div key={s.step} className={`rounded-xl border p-3 ${isLate ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.status==='completed'||s.status==='approved' ? 'bg-green-500 text-white' : s.status==='in_progress' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{s.step}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-700">{s.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${s.status==='completed'||s.status==='approved' ? 'bg-green-100 text-green-700' : s.status==='in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                              {isLate && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠️ Late</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {dl ? (
                                <span className={`text-xs font-medium ${daysLeft! < 0 ? 'text-red-600' : daysLeft! <= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                                  📅 {new Date(dl).toLocaleDateString('en-PK')} {daysLeft! < 0 ? `(${Math.abs(daysLeft!)}d overdue)` : daysLeft! === 0 ? '(Today!)' : `(${daysLeft}d left)`}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No deadline set</span>
                              )}
                              {s.completedAt && <span className="text-xs text-green-600">✓ Done: {new Date(s.completedAt).toLocaleDateString('en-PK')}</span>}
                            </div>
                          </div>
                          <input
                            type="date"
                            defaultValue={dl || ''}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-400 w-32 flex-shrink-0"
                            title="Set step deadline"
                            onChange={async (e) => {
                              if (e.target.value) {
                                await setStepDeadlineAsync(viewProject.id, s.step, e.target.value);
                                await loadData();
                                const updated = await fetchProjectByIdAsync(viewProject.id);
                                if (updated) setViewProject(updated);
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== MONITOR TAB COMPONENT =====
function MonitorTab({ allActiveProjects, statusColor, viewProjectPDF, generatePlanningPDF, generateAllProjectsExcel, generateProgressPDF }: any) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = allActiveProjects.filter((p: Project) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase()) ||
      (p.assignedTeam || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search project, city, leader..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="assigned">Assigned</option>
          <option value="accepted">Accepted</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">📊 Projects Progress</h3>
          <span className="text-xs text-slate-500">{filtered.length} of {allActiveProjects.length} projects</span>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No projects match your search</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium text-xs uppercase">Project</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs uppercase">City</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs uppercase">Leader</th>
                  <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs uppercase">Status</th>
                  <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs uppercase">Progress</th>
                  <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs uppercase">Deadline</th>
                  <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: Project) => {
                  const done = p.steps?.filter((s: any) => s.status === 'completed' || s.status === 'approved').length || 0;
                  const total = p.steps?.length || 11;
                  const pct = Math.round((done / total) * 100);
                  const daysLeft = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{p.projectType} • {p.capacity}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{p.city}</td>
                      <td className="py-3 px-3 text-slate-600">{p.assignedTeam || <span className="text-slate-300">—</span>}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{p.status.replace('_',' ')}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-10">{done}/{total}</span>
                        </div>
                        <div className="text-center text-xs text-slate-400 mt-0.5">{pct}%</div>
                      </td>
                      <td className={`py-3 px-3 text-center text-xs font-medium ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => viewProjectPDF(p)} className="p-1.5 hover:bg-orange-50 rounded-lg" title="View PDF"><Eye className="w-3.5 h-3.5 text-orange-600" /></button>
                          <button onClick={() => generatePlanningPDF(p)} className="p-1.5 hover:bg-green-50 rounded-lg" title="Download PDF"><Download className="w-3.5 h-3.5 text-green-600" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-wrap">
          <button onClick={() => generateAllProjectsExcel(allActiveProjects)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600"><Download className="w-4 h-4" />Excel Report</button>
          <button onClick={() => generateProgressPDF(allActiveProjects)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600"><Download className="w-4 h-4" />PDF Report</button>
        </div>
      </div>
    </div>
  );
}

// ===== TEAM OVERVIEW TAB =====
function TeamOverviewTab({ projects, leaders, statusColor, onViewProject }: any) {
  const [selectedLeader, setSelectedLeader] = useState<string>('all');

  // Group projects by leader
  const leaderMap: Record<string, { leader: User | null; projects: Project[] }> = {};

  // Unassigned bucket
  const unassigned = projects.filter((p: Project) => !p.assignedLeader && p.status !== 'new' && p.status !== 'rejected');
  if (unassigned.length > 0) {
    leaderMap['__unassigned__'] = { leader: null, projects: unassigned };
  }

  // Each leader's projects
  projects.filter((p: Project) => p.assignedLeader).forEach((p: Project) => {
    const lid = p.assignedLeader!;
    if (!leaderMap[lid]) {
      const leaderObj = leaders.find((l: User) => l.id === lid) || null;
      leaderMap[lid] = { leader: leaderObj, projects: [] };
    }
    leaderMap[lid].projects.push(p);
  });

  const leaderIds = Object.keys(leaderMap);
  const filtered = selectedLeader === 'all'
    ? leaderIds
    : leaderIds.filter(id => id === selectedLeader);

  return (
    <div className="space-y-5">
      {/* Leader filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedLeader('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedLeader === 'all' ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          All Teams ({leaderIds.length})
        </button>
        {leaders.map((l: User) => (
          leaderMap[l.id] && (
            <button key={l.id} onClick={() => setSelectedLeader(l.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedLeader === l.id ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              👷 {l.name} ({leaderMap[l.id]?.projects.length || 0})
            </button>
          )
        ))}
        {leaderMap['__unassigned__'] && (
          <button onClick={() => setSelectedLeader('__unassigned__')}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedLeader === '__unassigned__' ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            ⏳ Unassigned ({unassigned.length})
          </button>
        )}
      </div>

      {/* Leader cards */}
      {filtered.map(lid => {
        const { leader, projects: lProjects } = leaderMap[lid];
        const isUnassigned = lid === '__unassigned__';
        const totalSteps = lProjects.reduce((sum: number, p: Project) => sum + (p.steps?.length || 16), 0);
        const doneSteps = lProjects.reduce((sum: number, p: Project) =>
          sum + (p.steps?.filter(s => ['completed','approved'].includes(s.status)).length || 0), 0);
        const overallPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

        return (
          <div key={lid} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Leader header */}
            <div className={`px-5 py-4 ${isUnassigned ? 'bg-amber-50 border-b border-amber-100' : 'bg-purple-50 border-b border-purple-100'}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${isUnassigned ? 'bg-amber-400' : 'bg-purple-500'}`}>
                    {isUnassigned ? '?' : (leader?.name?.charAt(0) || '?')}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{isUnassigned ? 'Unassigned Projects' : leader?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{lProjects.length} site{lProjects.length !== 1 ? 's' : ''} assigned</p>
                  </div>
                </div>
                {!isUnassigned && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Overall Progress</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-white rounded-full overflow-hidden border border-purple-200">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${overallPct}%` }} />
                      </div>
                      <span className="text-sm font-bold text-purple-700">{overallPct}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Projects table */}
            <div className="divide-y divide-slate-50">
              {lProjects.map((p: Project) => {
                const done = p.steps?.filter((s: any) => ['completed','approved'].includes(s.status)).length || 0;
                const total = p.steps?.length || 16;
                const pct = Math.round((done / total) * 100);
                const daysLeft = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000);
                const currentStep = p.steps?.find((s: any) => s.status === 'in_progress') || p.steps?.find((s: any) => s.status === 'pending' && !s.locked);

                return (
                  <div key={p.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                          {p.workOrderNumber && <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.workOrderNumber}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{p.status.replace('_',' ')}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-slate-500 flex-wrap mb-2">
                          <span>📍 {p.city}</span>
                          <span>⚡ {p.capacity}</span>
                          <span>🏠 {p.projectType}</span>
                          <span className={daysLeft < 0 ? 'text-red-600 font-medium' : daysLeft <= 7 ? 'text-amber-600 font-medium' : ''}>
                            📅 {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </span>
                        </div>
                        {/* Step progress */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[200px] h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct > 50 ? '#a855f7' : '#f59e0b' }} />
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap">{done}/{total} steps ({pct}%)</span>
                        </div>
                        {currentStep && (
                          <p className="text-xs text-blue-600 mt-1">
                            🔄 Current: Step {currentStep.step} — {currentStep.name}
                          </p>
                        )}
                      </div>
                      <button onClick={() => onViewProject(p)} className="p-2 hover:bg-orange-50 rounded-lg flex-shrink-0">
                        <Eye className="w-4 h-4 text-orange-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No team data found</p>
        </div>
      )}
    </div>
  );
}
