import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Upload, Eye, Download, Plus, Trash2, ListChecks, ClipboardCheck, FileText, Bell, Lock, AlertTriangle, Loader2, Calendar, Clock } from 'lucide-react';
import { User, Project, TodoItem, MechanicalChecklist } from '../types';
import {
  fetchProjectsAsync, fetchNotificationsAsync,
  acceptProjectAsync, rejectByLeaderAsync,
  uploadStepFileAsync, completeStepAsync, updateMechanicalAsync,
  addTodoAsync, toggleTodoAsync, deleteTodoAsync,
  getFileDownloadUrl, viewFileInBrowser,
  setDelayReasonAsync,
} from '../store';

// Format date in Pakistan Standard Time (UTC+5)
function formatPKT(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
}


interface Props { user: User; }
type Tab = 'projects' | 'todo' | 'notifications';

export function TeamLeaderDashboard({ user }: Props) {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<import('../types').Notification[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [todoText, setTodoText] = useState('');
  const [todoPriority, setTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [todoProjectId, setTodoProjectId] = useState('');
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
  const [showDelayModal, setShowDelayModal] = useState<{ projectId: string; stepNum: number; stepName: string } | null>(null);
  const [delayInput, setDelayInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Reject modal
  const [rejectProjectModal, setRejectProjectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; onConfirm: () => void; type: 'warning' | 'success' | 'danger';
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [p, n] = await Promise.all([fetchProjectsAsync(), fetchNotificationsAsync('teamleader')]);
    setProjects(p); setNotifications(n);
    if (activeProject) {
      const updated = p.find(pr => pr.id === activeProject.id);
      if (updated) setActiveProject(updated);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const myProjects = projects.filter(p => p.assignedLeader === user.id);
  const pendingProjects = myProjects.filter(p => p.status === 'assigned');
  const activeProjects = myProjects.filter(p => ['accepted', 'in_progress'].includes(p.status));
  const completedProjects = myProjects.filter(p => p.status === 'completed');
  const allTodos = myProjects.flatMap(p => (p.todos || []).map(t => ({ ...t, projectName: p.name, projectId: p.id })));

  const deadlineWarnings = myProjects.filter(p => {
    const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 7 && p.status !== 'completed';
  });

  const handleAccept = async (p: Project) => {
    setConfirmDialog({
      title: '✅ Accept Project',
      message: `Accept "${p.name}"? This will notify the Planning team.`,
      type: 'success',
      onConfirm: async () => {
        setConfirmDialog(null);
        await acceptProjectAsync(p.id);
        await loadData();
      },
    });
  };

  const handleReject = async (p: Project) => {
    if (!rejectReason.trim()) {
      setRejectError('⚠️ Reject reason is MANDATORY!');
      return;
    }
    await rejectByLeaderAsync(p.id, rejectReason);
    await loadData();
    setRejectProjectModal(null); setRejectReason(''); setRejectError('');
  };

  const handleFileUpload = async (project: Project, stepNum: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmDialog({
      title: '📎 Upload File',
      message: `Upload "${file.name}" for Step ${stepNum}? Once uploaded, it goes to Planning for approval.`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        setUploading(true);
        const noteKey = `${project.id}-${stepNum}`;
        await uploadStepFileAsync(project.id, stepNum, file, stepNotes[noteKey] || '');
        await loadData();
        setUploading(false);
      },
    });
    e.target.value = '';
  };

  const handleCompleteStep = async (project: Project, stepNum: number) => {
    setConfirmDialog({
      title: '🔒 Complete & Lock Step',
      message: `Complete Step ${stepNum} "${project.steps.find(s => s.step === stepNum)?.name}"?\n\n⚠️ WARNING: Step will be PERMANENTLY LOCKED after completion.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await completeStepAsync(project.id, stepNum);
        await loadData();
      },
    });
  };

  const handleMechanical = async (project: Project, field: keyof MechanicalChecklist, value: boolean) => {
    const fieldLabel = field.replace(/([A-Z])/g, ' $1').trim();
    setConfirmDialog({
      title: value ? '✅ Check Item' : '❌ Uncheck Item',
      message: `${value ? 'CHECK' : 'UNCHECK'} "${fieldLabel}"? This will be recorded in the report.`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        await updateMechanicalAsync(project.id, field, value);
        await loadData();
      },
    });
  };

  const handleAddTodo = async (projectId: string) => {
    if (!todoText.trim()) return;
    await addTodoAsync(projectId, todoText, todoPriority);
    await loadData();
    setTodoText('');
  };

  const handleToggleTodo = async (_projectId: string, todoId: string) => {
    await toggleTodoAsync(todoId);
    await loadData();
  };

  const handleDeleteTodo = async (_projectId: string, todoId: string) => {
    if (!confirm('Delete this task?')) return;
    await deleteTodoAsync(todoId);
    await loadData();
  };

  const handleDelaySubmit = async () => {
    if (!showDelayModal || !delayInput.trim()) return;
    await setDelayReasonAsync(showDelayModal.projectId, showDelayModal.stepNum, delayInput);
    await loadData();
    setShowDelayModal(null);
    setDelayInput('');
  };

  const downloadFile = (file: { id?: string; name: string }) => {
    if (file.id) { window.open(getFileDownloadUrl(file.id), '_blank'); }
  };

  const statusColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', assigned: 'bg-purple-100 text-purple-700',
    accepted: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700',
  };
  const priorityColor: Record<string, string> = { low: 'bg-blue-100 text-blue-700', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700' };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /><span className="ml-3 text-slate-500">Loading...</span></div>;

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-slate-800">👷 Team Leader Dashboard</h2><p className="text-slate-500">Accept projects, complete 16 steps, manage tasks</p></div>

      {deadlineWarnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
          <h3 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Deadline Alerts!</h3>
          {deadlineWarnings.map(p => {
            const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return <p key={p.id} className="text-sm text-red-600">⚠️ <strong>{p.name}</strong>: {days < 0 ? `${Math.abs(days)} days OVERDUE!` : `Only ${days} days left!`}</p>;
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Accept', count: pendingProjects.length, color: 'bg-amber-500' },
          { label: 'Active', count: activeProjects.length, color: 'bg-blue-500' },
          { label: 'Completed', count: completedProjects.length, color: 'bg-green-500' },
          { label: 'To-Do Items', count: allTodos.filter(t => !t.completed).length, color: 'bg-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-white font-bold text-lg mb-2`}>{s.count}</div>
            <p className="text-sm text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {([
          { key: 'projects' as const, label: 'Projects & Steps', icon: ClipboardCheck },
          { key: 'todo' as const, label: 'To-Do List', icon: ListChecks, badge: allTodos.filter(t => !t.completed).length },
          { key: 'notifications' as const, label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.read).length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span>
            {'badge' in t && (t.badge ?? 0) > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'projects' && (
        <div className="space-y-4">
          {pendingProjects.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-amber-700">⏳ Awaiting Your Response</h3>
              {pendingProjects.map(p => (
                <div key={p.id} className="bg-amber-50 rounded-2xl p-5 border border-amber-200 space-y-3">
                  <div><div className="flex items-center gap-2"><h3 className="font-bold text-slate-800">{p.name}</h3>{p.workOrderNumber && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{p.workOrderNumber}</span>}</div>
                    <p className="text-sm text-slate-600">{p.city} | {p.capacity} | {p.projectType}</p>
                    <p className="text-xs text-slate-400 mt-1">📅 Deadline: {new Date(p.deadline).toLocaleDateString('en-PK')} ({Math.ceil((new Date(p.deadline).getTime()-Date.now())/86400000)}d left)</p>
                    <p className="text-sm text-slate-600 mt-2">{p.description}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAccept(p)} className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600"><CheckCircle className="w-4 h-4" /> Accept</button>
                    <button onClick={() => { setRejectProjectModal(p.id); setRejectReason(''); setRejectError(''); }} className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600"><XCircle className="w-4 h-4" /> Reject</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeProjects.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-blue-700">🔧 Active Projects</h3>
              {activeProjects.map(p => {
                const done = p.steps ? p.steps.filter(s => ['completed', 'approved'].includes(s.status)).length : 0;
                return (
                  <div key={p.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-slate-800">{p.name}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{p.status.replace('_', ' ')}</span></div><p className="text-sm text-slate-500">{p.city} | {p.capacity} | {p.projectType}</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => setActiveProject(activeProject?.id === p.id ? null : p)} className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100"><FileText className="w-3.5 h-3.5" /> {activeProject?.id === p.id ? 'Close' : 'Work'}</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3"><div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-green-500 rounded-full transition-all" style={{ width: `${(done / (p.steps.length||16)) * 100}%` }} /></div><span className="text-sm font-bold text-slate-600">{done}/{p.steps.length||16}</span></div>

                    {activeProject?.id === p.id && p.steps && (
                      <div className="space-y-3 mt-4">
                        {p.steps.map(s => {
                          // Execution parent (step 8): always show, locked until step 7 done
                          const isExecutionParent = s.step === 8;
                          // Sub-steps (9-16): unlocked when step 7 done (they all open together)
                          const isSub = s.type === 'sub';
                          const canWork = !s.locked && s.status !== 'completed' && s.status !== 'approved';
                          const isLocked = s.locked && s.status === 'pending';
                          const isCompleted = ['completed', 'approved'].includes(s.status);

                          return (
                            <div key={s.step} className={`rounded-xl p-4 border ${
                              isExecutionParent ? 'bg-indigo-50 border-indigo-200' :
                              isSub ? 'ml-4 ' + (isCompleted ? 'bg-green-50 border-green-200' : s.status === 'rejected' ? 'bg-red-50 border-red-200' : s.status === 'in_progress' ? 'bg-amber-50 border-amber-200' : isLocked ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-purple-200') :
                              isCompleted ? 'bg-green-50 border-green-200' : s.status === 'rejected' ? 'bg-red-50 border-red-200' : s.status === 'in_progress' ? 'bg-amber-50 border-amber-200' : isLocked ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'
                            }`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                    isExecutionParent ? 'bg-indigo-500 text-white' :
                                    isCompleted ? 'bg-green-500 text-white' : s.status === 'in_progress' ? 'bg-amber-500 text-white' : s.status === 'rejected' ? 'bg-red-500 text-white' : isSub ? 'bg-purple-300 text-white' : 'bg-slate-300 text-white'
                                  }`}>
                                    {isCompleted ? '✓' : isLocked ? <Lock className="w-3.5 h-3.5" /> : s.step}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800 text-sm">
                                      {isSub && <span className="text-purple-400 mr-1 text-xs">↳</span>}
                                      {s.name}
                                    </p>
                                    <p className="text-xs text-slate-500">{
                                      isExecutionParent ? 'All sub-steps below must be completed' :
                                      isCompleted ? `Completed ${s.completedAt ? formatPKT(s.completedAt) : ''}` :
                                      s.status === 'rejected' ? 'Rejected — redo required' :
                                      s.status === 'in_progress' ? 'Waiting for approval' :
                                      isLocked ? 'Locked — complete required steps first' : 'Ready'
                                    }</p>
                                    {/* Step deadline + late warning */}
                                    {s.stepDeadline && !isExecutionParent && (() => {
                                      const dl = new Date(s.stepDeadline);
                                      const now = Date.now();
                                      const daysLeft = Math.ceil((dl.getTime() - now) / 86400000);
                                      const isLate = !isCompleted && daysLeft < 0;
                                      const completedLate = isCompleted && s.completedAt && new Date(s.completedAt) > dl;
                                      return (
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          <span className={`text-xs flex items-center gap-1 ${isLate ? 'text-red-600 font-medium' : daysLeft <= 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                                            <Calendar className="w-3 h-3" />
                                            {dl.toLocaleDateString('en-PK')}
                                            {!isCompleted && ` (${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today!' : `${daysLeft}d left`})`}
                                          </span>
                                          {isLate && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">⚠️ LATE</span>}
                                          {completedLate && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Completed late</span>}
                                        </div>
                                      );
                                    })()}
                                    {/* Delay reason shown */}
                                    {s.delayReason && (
                                      <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">⏱️ Delay: {s.delayReason}</p>
                                    )}
                                  </div>
                                </div>
                                {!isLocked && !isExecutionParent && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[s.status] || 'bg-slate-100 text-slate-500'}`}>{s.status}</span>}
                              </div>

                              {/* Mechanical checklist for step 9 (Mechanical sub-step) */}
                              {s.step === 9 && canWork && !isCompleted && (
                                <div className="bg-white rounded-lg p-3 mb-3 border border-slate-200 space-y-2">
                                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Mechanical Checklist:</p>
                                  {([
                                    { key: 'basePlatesInstalled' as const, label: 'Base Plates / H-beam Installed?' },
                                    { key: 'uChannelInstalled' as const, label: 'U-Channel Installed?' },
                                    { key: 'panelsInstalled' as const, label: 'Panels Installed?' },
                                    { key: 'paintCivilComplete' as const, label: 'Paint / Civil Complete?' },
                                  ]).map(item => (
                                    <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg">
                                      <input type="checkbox" checked={s.mechanicalChecklist?.[item.key] || false}
                                        onChange={e => handleMechanical(p, item.key, e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-green-600" />
                                      <span className="text-sm text-slate-700">{item.label}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {s.step === 9 && s.mechanicalChecklist && isCompleted && (
                                <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200 space-y-1">
                                  <p className="text-xs font-bold text-green-700 uppercase">Mechanical Checklist (Locked):</p>
                                  {(['basePlatesInstalled', 'uChannelInstalled', 'panelsInstalled', 'paintCivilComplete'] as const).map(key => (
                                    <p key={key} className="text-sm text-green-700">{s.mechanicalChecklist![key] ? '✅' : '❌'} {key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                  ))}
                                  {s.mechanicalChecklist.completedBy && <p className="text-xs text-green-600 mt-1">Checked by: {s.mechanicalChecklist.completedBy} | {s.mechanicalChecklist.completedAt ? formatPKT(s.mechanicalChecklist.completedAt) : ''}</p>}
                                </div>
                              )}

                              {/* Files */}
                              {s.files && s.files.length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  {s.files.map(f => (
                                    <div key={f.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm border border-slate-100">
                                      <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      <span className="flex-1 text-slate-700 truncate text-xs">{f.name}</span>
                                      <span className="text-xs text-slate-400 hidden sm:block">{formatPKT(f.uploadedAt)}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${f.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : f.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.approvalStatus || 'pending'}</span>
                                      {f.approvalNote && f.approvalStatus === 'rejected' && <span className="text-xs text-red-500 flex-shrink-0 max-w-[80px] truncate" title={f.approvalNote}>📝 {f.approvalNote.substring(0,20)}</span>}
                                      <button onClick={() => viewFileInBrowser(f.id, f.name)} className="p-1 hover:bg-orange-50 rounded flex-shrink-0" title="View"><Eye className="w-3.5 h-3.5 text-orange-600" /></button>
                                      <button onClick={() => downloadFile(f)} className="p-1 hover:bg-blue-50 rounded flex-shrink-0" title="Download"><Download className="w-3.5 h-3.5 text-blue-600" /></button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {canWork && !isCompleted && (
                                <div className="space-y-2 mt-2">
                                  <textarea placeholder={`Notes/description for ${s.name}...`} value={stepNotes[`${p.id}-${s.step}`] || s.description || ''} onChange={e => setStepNotes({ ...stepNotes, [`${p.id}-${s.step}`]: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" rows={2} />
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <label className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 cursor-pointer">
                                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload File
                                      <input type="file" className="hidden" onChange={e => handleFileUpload(p, s.step, e)} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" disabled={uploading} />
                                    </label>
                                    {s.files && s.files.length > 0 && s.status !== 'completed' && (
                                      <button onClick={() => handleCompleteStep(p, s.step)} className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100"><CheckCircle className="w-3.5 h-3.5" /> Complete & Lock</button>
                                    )}
                                    {s.stepDeadline && !isCompleted && (() => {
                                      const daysLeft = Math.ceil((new Date(s.stepDeadline).getTime() - Date.now()) / 86400000);
                                      return daysLeft < 0 ? (
                                        <button onClick={() => { setShowDelayModal({ projectId: p.id, stepNum: s.step, stepName: s.name }); setDelayInput(s.delayReason || ''); }}
                                          className="flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 border border-amber-200">
                                          <Clock className="w-3.5 h-3.5" /> {s.delayReason ? 'Update Delay' : 'Report Delay'}
                                        </button>
                                      ) : null;
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {completedProjects.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-green-700">✅ Completed Projects</h3>
              {completedProjects.map(p => (
                <div key={p.id} className="bg-green-50 rounded-2xl p-5 border border-green-200">
                  <div className="flex justify-between items-center">
                    <div><div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /><h3 className="font-bold text-slate-800">{p.name}</h3></div><p className="text-sm text-slate-500 mt-1">{p.city} | All steps completed</p></div>
                  </div>
                </div>
              ))}
            </>
          )}

          {myProjects.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border"><ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No projects assigned yet</p></div>}
        </div>
      )}

      {tab === 'todo' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800">➕ Add New Task</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={todoProjectId} onChange={e => setTodoProjectId(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"><option value="">Select Project</option>{myProjects.filter(p => !['completed', 'rejected'].includes(p.status)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <input placeholder="Task description..." value={todoText} onChange={e => setTodoText(e.target.value)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm" />
              <select value={todoPriority} onChange={e => setTodoPriority(e.target.value as TodoItem['priority'])} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
              <button onClick={() => todoProjectId && handleAddTodo(todoProjectId)} disabled={!todoText.trim() || !todoProjectId} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold disabled:opacity-50"><Plus className="w-4 h-4 inline mr-1" /> Add</button>
            </div>
          </div>
          {myProjects.filter(p => p.todos && p.todos.length > 0).map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ListChecks className="w-4 h-4 text-orange-500" /> {p.name} <span className="text-xs text-slate-400 font-normal">({p.todos.filter(t => !t.completed).length} pending)</span></h4>
              <div className="space-y-2">
                {p.todos.map(t => (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${t.completed ? 'bg-slate-50' : 'bg-white border border-slate-100'}`}>
                    <button onClick={() => handleToggleTodo(p.id, t.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${t.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-orange-500'}`}>{t.completed && <CheckCircle className="w-3.5 h-3.5 text-white" />}</button>
                    <span className={`flex-1 text-sm ${t.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.text}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColor[t.priority]}`}>{t.priority}</span>
                    <button onClick={() => handleDeleteTodo(p.id, t.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {allTodos.length === 0 && <div className="text-center py-12 bg-white rounded-2xl border"><ListChecks className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No tasks yet.</p></div>}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="font-semibold text-slate-700">Notifications</span>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{notifications.filter(n => !n.read).length} new</span>
              )}
            </div>
          </div>
          {notifications.length === 0
            ? <div className="text-center py-12 bg-white rounded-2xl border"><Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No notifications</p></div>
            : <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                {notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? 'bg-amber-50' : 'opacity-60'}`}>
                    <span className="text-lg mt-0.5 flex-shrink-0">
                      {n.type === 'approval_needed' ? '📋' : n.type === 'deadline_warning' ? '⏰' : n.type === 'step_completed' ? '✅' : '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{n.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatPKT(n.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* DELAY REASON MODAL */}
      {showDelayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              <h3 className="text-xl font-bold text-slate-800">Report Delay</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm font-medium text-amber-800">Step {showDelayModal.stepNum}: {showDelayModal.stepName}</p>
              <p className="text-xs text-amber-600 mt-0.5">This delay will be reported to Planning Team</p>
            </div>
            <textarea
              value={delayInput}
              onChange={e => setDelayInput(e.target.value)}
              rows={4}
              placeholder="Explain the reason for delay... (e.g. material not received, weather issue, client unavailable)"
              className="w-full px-4 py-3 border-2 border-amber-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleDelaySubmit}
                disabled={!delayInput.trim()}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" /> Submit Delay Reason
              </button>
              <button
                onClick={() => { setShowDelayModal(null); setDelayInput(''); }}
                className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT PROJECT MODAL — Reason MANDATORY */}
      {rejectProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-xl font-bold text-slate-800">Reject Project — Reason Required</h3>
            </div>
            <p className="text-sm text-slate-500">You MUST provide a reason for rejection. This will be sent to Planning team and recorded in reports.</p>
            {rejectError && <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm"><AlertTriangle className="w-4 h-4" /> {rejectError}</div>}
            <textarea value={rejectReason} onChange={e => { setRejectReason(e.target.value); setRejectError(''); }}
              rows={4} placeholder="Describe the reason for rejection... (MANDATORY)"
              className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-3">
              <button onClick={() => { const p = projects.find(pr => pr.id === rejectProjectModal); if (p) handleReject(p); }}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" /> Confirm Reject
              </button>
              <button onClick={() => { setRejectProjectModal(null); setRejectReason(''); setRejectError(''); }}
                className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG — For all critical actions */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              {confirmDialog.type === 'success' && <CheckCircle className="w-6 h-6 text-green-500" />}
              {confirmDialog.type === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-500" />}
              {confirmDialog.type === 'danger' && <AlertTriangle className="w-6 h-6 text-red-500" />}
              <h3 className="text-lg font-bold text-slate-800">{confirmDialog.title}</h3>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-line">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={confirmDialog.onConfirm}
                className={`flex-1 py-2.5 text-white rounded-xl font-semibold flex items-center justify-center gap-2 ${
                  confirmDialog.type === 'success' ? 'bg-green-500 hover:bg-green-600' :
                  confirmDialog.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-red-500 hover:bg-red-600'
                }`}>
                <CheckCircle className="w-4 h-4" /> Yes, Confirm
              </button>
              <button onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
