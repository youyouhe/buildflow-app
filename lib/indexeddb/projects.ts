import { getDB, Project, ProjectFile } from './index';

/**
 * Get all projects sorted by last updated
 */
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const tx = db.transaction('projects', 'readonly');
  const index = tx.store.index('by-updated');
  const projects = await index.getAll();
  await tx.done;
  return projects.reverse(); // Most recent first
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return await db.get('projects', id);
}

/**
 * Create a new project
 */
export async function createProject(
  project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Project> {
  const db = await getDB();
  const now = Date.now();
  const newProject: Project = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  
  await db.put('projects', newProject);
  return newProject;
}

/**
 * Update an existing project
 */
export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project | null> {
  const db = await getDB();
  const existing = await db.get('projects', id);
  
  if (!existing) {
    return null;
  }
  
  const updated: Project = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  
  await db.put('projects', updated);
  return updated;
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get('projects', id);
  
  if (!existing) {
    return false;
  }
  
  await db.delete('projects', id);
  return true;
}

/**
 * Update project files
 */
export async function updateProjectFiles(
  id: string,
  files: ProjectFile[]
): Promise<Project | null> {
  return await updateProject(id, { files });
}

/**
 * Add a prompt to project history
 */
export async function addPromptToProject(
  id: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<Project | null> {
  const db = await getDB();
  const project = await db.get('projects', id);
  
  if (!project) {
    return null;
  }
  
  const prompts = [
    ...project.prompts,
    {
      role,
      content,
      timestamp: Date.now(),
    },
  ];
  
  return await updateProject(id, { prompts });
}

/**
 * Update GitHub integration info
 */
export async function updateProjectGitHub(
  id: string,
  github: Project['github']
): Promise<Project | null> {
  return await updateProject(id, { github });
}

/**
 * Update Vercel integration info
 */
export async function updateProjectVercel(
  id: string,
  vercel: Project['vercel']
): Promise<Project | null> {
  return await updateProject(id, { vercel });
}

/**
 * Mark project as deployed
 */
export async function markProjectDeployed(id: string): Promise<Project | null> {
  return await updateProject(id, { deployedAt: Date.now() });
}

/**
 * Export all projects as JSON
 */
export async function exportAllProjects(): Promise<string> {
  const projects = await getAllProjects();
  return JSON.stringify(projects, null, 2);
}

/**
 * Import projects from JSON
 */
export async function importProjects(json: string): Promise<number> {
  const db = await getDB();
  const projects = JSON.parse(json) as Project[];
  
  const tx = db.transaction('projects', 'readwrite');
  for (const project of projects) {
    await tx.store.put(project);
  }
  await tx.done;
  
  return projects.length;
}
