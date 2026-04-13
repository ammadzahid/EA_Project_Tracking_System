import { useState, useEffect } from 'react';
import { Plus, Upload, FileText, Eye, X, Search, Download, MapPin, Calendar, Zap, DollarSign, Building2, AlertTriangle, Loader2, Bell, CheckCircle } from 'lucide-react';
import { User, Project, Notification } from '../types';
import { fetchProjectsAsync, createProjectAsync, getFileDownloadUrl, fetchNotificationsAsync, markNotificationReadAsync, markAllNotificationsReadAsync } from '../store';

type Tab = 'projects' | 'notifications';

interface Props { user: User; }

export function SellingDashboard({ user }: Props) {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '', location: '', city: '', budget: 0,
    capacity: '', projectType: 'Residential' as Project['projectType'],
    deadline: '', description: ''
  });
  const [quotationAdminFile, setQuotationAdminFile] = useState<File | null>(null);
  const [quotationAdminPreview, setQuotationAdminPreview] = useState<string>('');
  const [quotationPlanningFile, setQuotationPlanningFile] = useState<File | null>(null);
  const [quotationPlanningPreview, setQuotationPlanningPreview] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    const [data, notifs] = await Promise.all([fetchProjectsAsync(), fetchNotificationsAsync('selling')]);
    setProjects(data);
    setNotifications(notifs);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const myProjects = projects.filter(p => p.createdBy === user.id);
  const filtered = myProjects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdminFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setFormError('File size must be under 50MB'); return; }
    setQuotationAdminFile(file);
    setQuotationAdminPreview(file.name);
    setFormError('');
  };

  const handlePlanningFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setFormError('File size must be under 50MB'); return; }
    setQuotationPlanningFile(file);
    setQuotationPlanningPreview(file.name);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.location || !form.city || !form.budget || !form.capacity || !form.deadline || !form.description) {
      setFormError('All fields are required'); return;
    }
    if (!quotationAdminFile) { setFormError('Quotation for Admin is mandatory!'); return; }

    setSubmitting(true);
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('location', form.location);
    fd.append('city', form.city);
    fd.append('budget', form.budget.toString());
    fd.append('capacity', form.capacity);
    fd.append('projectType', form.projectType);
    fd.append('deadline', form.deadline);
    fd.append('description', form.description);
    fd.append('quotation_admin', quotationAdminFile);
    if (quotationPlanningFile) fd.append('quotation_planning', quotationPlanningFile);

    const result = await createProjectAsync(fd);
    if (result.success) {
      await loadData();
      setShowForm(false);
      setForm({ name: '', location: '', city: '', budget: 0, capacity: '', projectType: 'Residential', deadline: '', description: '' });
      setQuotationAdminFile(null); setQuotationAdminPreview('');
      setQuotationPlanningFile(null); setQuotationPlanningPreview('');
    } else {
      setFormError(result.message || 'Failed to create project');
    }
    setSubmitting(false);
  };

  const statusColor: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700',
    assigned: 'bg-purple-100 text-purple-700', accepted: 'bg-indigo-100 text-indigo-700',
    in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const dw = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-red-600' };
    if (days <= 7) return { text: `${days}d left`, color: 'text-amber-600' };
    return { text: `${days}d left`, color: 'text-green-600' };
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /><span className="ml-3 text-slate-500">Loading...</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🏢 Sales Department</h2>
          <p className="text-slate-500">Create and track solar projects</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setTab('notifications'); }} className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${tab === 'notifications' ? 'bg-orange-100 text-orange-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unreadCount}</span>}
          </button>
          <button onClick={() => { setTab('projects'); setShowForm(true); setFormError(''); }} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 shadow-lg transition-all">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: myProjects.length, color: 'bg-blue-500', icon: '📊' },
          { label: 'Pending', count: myProjects.filter(p => p.status === 'new').length, color: 'bg-amber-500', icon: '⏳' },
          { label: 'Approved', count: myProjects.filter(p => p.status === 'approved').length, color: 'bg-green-500', icon: '✅' },
          { label: 'In Progress', count: myProjects.filter(p => ['assigned','accepted','in_progress'].includes(p.status)).length, color: 'bg-purple-500', icon: '🔧' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-white font-bold text-lg`}>{s.count}</div>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setTab('projects')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'projects' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText className="w-4 h-4 inline mr-1.5" />My Projects ({myProjects.length})
        </button>
        <button onClick={() => setTab('notifications')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all relative ${tab === 'notifications' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
          <Bell className="w-4 h-4 inline mr-1.5" />Notifications
          {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{unreadCount}</span>}
        </button>
      </div>

      {tab === 'projects' && <>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No projects yet. Click "New Project" to start!</p>
          </div>
        )}
        {filtered.map(p => {
          const d = dw(p.deadline);
          return (
            <div key={p.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{p.status.replace('_',' ').toUpperCase()}</span>
                    {p.workOrderNumber && <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-600">{p.workOrderNumber}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{p.capacity}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />PKR {p.budget.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.projectType}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={`text-xs font-medium ${d.color} flex items-center gap-1`}><Calendar className="w-3 h-3" />{d.text}</span>
                    {p.quotationFile && <span className="text-xs text-orange-600">📋 Admin Quotation</span>}
                    {p.quotationPlanningFile && <span className="text-xs text-blue-600">📐 Planning Quotation</span>}
                  </div>
                  {p.rejectedReason && <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded-lg">❌ {p.rejectedReason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {p.quotationFile?.id && (
                    <button onClick={() => window.open(getFileDownloadUrl(p.quotationFile!.id!), '_blank')} className="p-2 hover:bg-orange-100 rounded-lg" title="Download Admin Quotation">
                      <Download className="w-4 h-4 text-orange-500" />
                    </button>
                  )}
                  {p.quotationPlanningFile?.id && (
                    <button onClick={() => window.open(getFileDownloadUrl(p.quotationPlanningFile!.id!), '_blank')} className="p-2 hover:bg-blue-100 rounded-lg" title="Download Planning Quotation">
                      <Download className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                  <button onClick={() => setViewProject(p)} className="p-2 hover:bg-orange-100 rounded-lg" title="View Details">
                    <Eye className="w-4 h-4 text-orange-600" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>}

      {tab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-700">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              {unreadCount > 0 && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">{unreadCount} unread</span>}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={async () => { await markAllNotificationsReadAsync(); await loadData(); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No notifications yet</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={async () => { if (!n.read) { await markNotificationReadAsync(n.id); await loadData(); } }}
                className={`bg-white rounded-2xl p-4 border cursor-pointer transition-all ${n.read ? 'border-slate-100 opacity-70' : 'border-orange-200 shadow-sm hover:shadow-md'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-slate-300' : 'bg-orange-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Project Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">📋 New Project</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm"><AlertTriangle className="w-4 h-4" />{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Project Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" placeholder="e.g. Lahore Solar 10kW" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Location <span className="text-red-500">*</span></label>
                  <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Full address" required /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">City <span className="text-red-500">*</span></label>
                  <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Lahore" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Budget (PKR) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.budget||''} onChange={e => setForm({...form, budget: Number(e.target.value)})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="1500000" required /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Capacity <span className="text-red-500">*</span></label>
                  <input type="text" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="10kW" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Type</label>
                  <select value={form.projectType} onChange={e => setForm({...form, projectType: e.target.value as Project['projectType']})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm">
                    <option value="Residential">Residential</option><option value="Commercial">Commercial</option><option value="Industrial">Industrial</option><option value="Agricultural">Agricultural</option>
                  </select></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Deadline <span className="text-red-500">*</span></label>
                  <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm" required /></div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Description <span className="text-red-500">*</span></label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none" placeholder="Client details, site info, requirements..." required />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Quotation for Admin <span className="text-red-500">*</span></label>
                <div className={`border-2 border-dashed ${quotationAdminFile ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-orange-400'} rounded-xl p-4 text-center transition-colors`}>
                  <input type="file" onChange={handleAdminFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" className="hidden" id="quotation-admin-upload" />
                  <label htmlFor="quotation-admin-upload" className="cursor-pointer">
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${quotationAdminFile ? 'text-green-500' : 'text-slate-400'}`} />
                    {quotationAdminFile
                      ? <div><p className="text-sm text-green-600 font-semibold">✓ {quotationAdminPreview}</p><p className="text-xs text-green-500">{(quotationAdminFile.size/1024).toFixed(1)} KB — Click to change</p></div>
                      : <div><p className="text-sm text-slate-600 font-medium">Click to upload quotation for Admin</p><p className="text-xs text-slate-400">PDF, Word, Excel, Image • Max 50MB</p></div>
                    }
                  </label>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Quotation for Planning Team <span className="text-slate-400 text-xs">(Optional)</span></label>
                <div className={`border-2 border-dashed ${quotationPlanningFile ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-400'} rounded-xl p-4 text-center transition-colors`}>
                  <input type="file" onChange={handlePlanningFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" className="hidden" id="quotation-planning-upload" />
                  <label htmlFor="quotation-planning-upload" className="cursor-pointer">
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${quotationPlanningFile ? 'text-blue-500' : 'text-slate-400'}`} />
                    {quotationPlanningFile
                      ? <div><p className="text-sm text-blue-600 font-semibold">✓ {quotationPlanningPreview}</p><p className="text-xs text-blue-500">{(quotationPlanningFile.size/1024).toFixed(1)} KB — Click to change</p></div>
                      : <div><p className="text-sm text-slate-600 font-medium">Click to upload quotation for Planning Team</p><p className="text-xs text-slate-400">PDF, Word, Excel, Image • Max 50MB</p></div>
                    }
                  </label>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : '✅ Create Project'}
              </button>
            </form>
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500">Location</p><p className="font-medium">{viewProject.location}</p></div>
              <div><p className="text-slate-500">City</p><p className="font-medium">{viewProject.city}</p></div>
              <div><p className="text-slate-500">Budget</p><p className="font-medium">PKR {viewProject.budget.toLocaleString()}</p></div>
              <div><p className="text-slate-500">Capacity</p><p className="font-medium">{viewProject.capacity}</p></div>
              <div><p className="text-slate-500">Type</p><p className="font-medium">{viewProject.projectType}</p></div>
              <div><p className="text-slate-500">Deadline</p><p className="font-medium">{new Date(viewProject.deadline).toLocaleDateString()}</p></div>
              <div><p className="text-slate-500">Status</p><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[viewProject.status]}`}>{viewProject.status.replace('_',' ').toUpperCase()}</span></div>
              {viewProject.workOrderNumber && <div><p className="text-slate-500">Work Order</p><p className="font-medium font-mono">{viewProject.workOrderNumber}</p></div>}
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1 font-medium">📝 Description</p>
              <p className="text-sm text-slate-700">{viewProject.description}</p>
            </div>
            {viewProject.rejectedReason && (
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-500 mb-1 font-medium">❌ Rejection Reason</p>
                <p className="text-sm text-red-700">{viewProject.rejectedReason}</p>
              </div>
            )}
            {viewProject.quotationFile?.id && (
              <button onClick={() => window.open(getFileDownloadUrl(viewProject.quotationFile!.id!), '_blank')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-100 w-full justify-center">
                <Download className="w-4 h-4" /> 📋 Quotation for Admin: {viewProject.quotationFile.name}
              </button>
            )}
            {viewProject.quotationPlanningFile?.id && (
              <button onClick={() => window.open(getFileDownloadUrl(viewProject.quotationPlanningFile!.id!), '_blank')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 w-full justify-center">
                <Download className="w-4 h-4" /> 📐 Quotation for Planning Team: {viewProject.quotationPlanningFile.name}
              </button>
            )}
            {viewProject.steps?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Project Progress</h4>
                <div className="space-y-1.5">
                  {viewProject.steps.map(s => (
                    <div key={s.step} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${s.status==='completed'||s.status==='approved' ? 'bg-green-500 text-white' : s.status==='in_progress' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{s.step}</div>
                      <span className="text-sm text-slate-600 flex-1">{s.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status==='completed'||s.status==='approved' ? 'bg-green-100 text-green-700' : s.status==='in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
