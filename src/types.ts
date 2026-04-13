

export type UserRole = 'selling' | 'superadmin' | 'planning' | 'teamleader';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  approved: boolean;
  createdAt: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  data: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  step?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalNote?: string;
  approvedAt?: string;
}

export interface VoiceNote {
  id: string;
  data: string;
  duration: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface BOQItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface BOQDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName?: string;
  comment?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  priority: 'low' | 'medium' | 'high';
  projectId: string;
}

export interface MechanicalChecklist {
  basePlatesInstalled: boolean;
  uChannelInstalled: boolean;
  panelsInstalled: boolean;
  paintCivilComplete: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface ProjectStep {
  step: number;
  name: string;
  type: 'main' | 'sub';
  parentStep?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';
  files: ProjectFile[];
  completedAt?: string;
  notes?: string;
  description?: string;
  locked: boolean;
  stepDeadline?: string;
  delayReason?: string;
  mechanicalChecklist?: MechanicalChecklist;
}

export interface Notification {
  id: string;
  type: 'project_assigned' | 'project_accepted' | 'step_completed' | 'deadline_warning' | 'approval_needed' | 'signup_request';
  message: string;
  projectId?: string;
  createdAt: string;
  read: boolean;
  forRole: UserRole;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  city: string;
  budget: number;
  capacity: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural';
  deadline: string;
  description: string;
  status: 'new' | 'approved' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  createdBy: string;
  createdAt: string;
  quotationFile?: ProjectFile;
  quotationPlanningFile?: ProjectFile;
  voiceNote?: VoiceNote;
  approvedBy?: string;
  approvedAt?: string;
  assignedTeam?: string;
  assignedLeader?: string;
  assignedAt?: string;
  acceptedAt?: string;
  rejectedReason?: string;
  boq: BOQItem[];
  boqDocuments?: BOQDocument[];
  steps: ProjectStep[];
  todos: TodoItem[];
  workOrderNumber?: string;
}

export const PROJECT_STEPS: { step: number; name: string; type: 'main' | 'sub'; parentStep?: number }[] = [
  { step: 1,  name: 'Survey',                    type: 'main' },
  { step: 2,  name: 'Design',                    type: 'main' },
  { step: 3,  name: 'Material Demand',            type: 'main' },
  { step: 4,  name: 'Purchase Order',             type: 'main' },
  { step: 5,  name: 'Procurement',                type: 'main' },
  { step: 6,  name: 'Material Dispatch',          type: 'main' },
  { step: 7,  name: 'Material Delivered',         type: 'main' },
  { step: 8,  name: 'Execution',                  type: 'main' },
  { step: 9,  name: 'Mechanical',                 type: 'sub', parentStep: 8 },
  { step: 10, name: 'Civil',                      type: 'sub', parentStep: 8 },
  { step: 11, name: 'Electric',                   type: 'sub', parentStep: 8 },
  { step: 12, name: 'Earthing',                   type: 'sub', parentStep: 8 },
  { step: 13, name: 'Load Distribution',          type: 'sub', parentStep: 8 },
  { step: 14, name: 'Commissioning & Testing',    type: 'sub', parentStep: 8 },
  { step: 15, name: 'User Training & Reviews',    type: 'sub', parentStep: 8 },
  { step: 16, name: 'Documentation',              type: 'sub', parentStep: 8 },
];
