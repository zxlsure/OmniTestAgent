import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface FlowActivity { id: string; project_id: string; activity_type: string; status: string; input_data: string | null; output_data: string | null; started_at: string | null; completed_at: string | null; created_at: string; updated_at: string }
export interface FlowReviewRecord { id: string; activity_id: string; result: string; comment: string | null; reviewer: string | null; reviewed_at: string }

export class FlowActivityRepo {
  create(projectId: string, activityType: string): FlowActivity {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run("INSERT INTO test_flow_activity (id, project_id, activity_type, status, created_at, updated_at) VALUES (?, ?, ?, 'idle', ?, ?)", [id, projectId, activityType, now, now])
    return this.getById(id)!
  }
  getById(id: string): FlowActivity | null { return db().get('SELECT * FROM test_flow_activity WHERE id = ?', [id]) as FlowActivity | null }
  listByProject(projectId: string): FlowActivity[] { return db().all('SELECT * FROM test_flow_activity WHERE project_id = ? ORDER BY created_at ASC', [projectId]) as FlowActivity[] }
  getByType(projectId: string, activityType: string): FlowActivity | null { return db().get('SELECT * FROM test_flow_activity WHERE project_id = ? AND activity_type = ?', [projectId, activityType]) as FlowActivity | null }
  updateStatus(id: string, status: string, extra?: { outputData?: string; inputData?: string }): void {
    const now = new Date().toISOString()
    if (status === 'running') db().run("UPDATE test_flow_activity SET status = ?, started_at = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [status, now, id])
    else if (status === 'completed' || status === 'failed') db().run("UPDATE test_flow_activity SET status = ?, completed_at = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [status, now, id])
    else db().run("UPDATE test_flow_activity SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [status, id])
    if (extra?.outputData) db().run('UPDATE test_flow_activity SET output_data = ? WHERE id = ?', [extra.outputData, id])
    if (extra?.inputData) db().run('UPDATE test_flow_activity SET input_data = ? WHERE id = ?', [extra.inputData, id])
  }
  addReview(activityId: string, result: string, comment?: string, reviewer?: string): FlowReviewRecord {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO flow_review_record (id, activity_id, result, comment, reviewer, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)', [id, activityId, result, comment || null, reviewer || null, now])
    return db().get('SELECT * FROM flow_review_record WHERE id = ?', [id]) as FlowReviewRecord
  }
  getReviews(activityId: string): FlowReviewRecord[] { return db().all('SELECT * FROM flow_review_record WHERE activity_id = ? ORDER BY reviewed_at DESC', [activityId]) as FlowReviewRecord[] }
  resetRunningToIdle(projectId: string): number {
    return db().run("UPDATE test_flow_activity SET status = 'idle', started_at = NULL, updated_at = datetime('now', 'localtime') WHERE project_id = ? AND status = 'running'", [projectId]).changes
  }
}

export const flowActivityRepo = new FlowActivityRepo()
