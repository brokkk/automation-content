import { supabase } from './supabase';
import type { Database } from './database.types';

type ApprovalLog = Database['public']['Tables']['approval_logs']['Row'];

/**
 * Generate a secure approval token
 */
export function generateApprovalToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create approval request for a content item
 */
export async function createApprovalRequest(
    contentId: string,
    expiresInHours: number = 24
): Promise<{ token: string; approvalUrl: string }> {
    const token = generateApprovalToken();
    const tokenExpires = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('approval_logs')
        .insert({
            content_id: contentId,
            token,
            token_expires: tokenExpires,
        });

    if (error) throw error;

    // Update content status to waiting_approval
    await supabase
        .from('content_items')
        .update({ status: 'waiting_approval' })
        .eq('id', contentId);

    const baseUrl = window.location.origin;
    const approvalUrl = `${baseUrl}/approve/${token}`;

    return { token, approvalUrl };
}

/**
 * Validate approval token
 */
export async function validateApprovalToken(token: string): Promise<{
    valid: boolean;
    approvalLog?: ApprovalLog;
    content?: Database['public']['Tables']['content_items']['Row'];
    error?: string;
}> {
    const { data: approvalLog, error } = await supabase
        .from('approval_logs')
        .select('*')
        .eq('token', token)
        .single();

    if (error || !approvalLog) {
        return { valid: false, error: 'Invalid token' };
    }

    // Check if token is expired
    if (new Date(approvalLog.token_expires) < new Date()) {
        return { valid: false, error: 'Token expired' };
    }

    // Check if already actioned
    if (approvalLog.actioned_at) {
        return { valid: false, error: 'Token already used' };
    }

    // Get content item
    const { data: content } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', approvalLog.content_id)
        .single();

    return { valid: true, approvalLog, content: content || undefined };
}

/**
 * Process approval action
 */
export async function processApproval(
    token: string,
    action: 'approve' | 'reject',
    options?: {
        scheduledAt?: string;
        notes?: string;
        selectedVariation?: number;
    }
): Promise<{ success: boolean; error?: string }> {
    const validation = await validateApprovalToken(token);

    if (!validation.valid || !validation.approvalLog) {
        return { success: false, error: validation.error };
    }

    const { approvalLog, content } = validation;

    // Update approval log
    const { error: logError } = await supabase
        .from('approval_logs')
        .update({
            action,
            actioned_at: new Date().toISOString(),
            notes: options?.notes,
        })
        .eq('id', approvalLog.id);

    if (logError) {
        return { success: false, error: 'Failed to update approval log' };
    }

    // Update content status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: contentError } = await supabase
        .from('content_items')
        .update({
            status: newStatus,
            scheduled_at: action === 'approve' ? options?.scheduledAt : null,
            selected_var: options?.selectedVariation ?? content?.selected_var ?? 0,
            updated_at: new Date().toISOString(),
        })
        .eq('id', approvalLog.content_id);

    if (contentError) {
        return { success: false, error: 'Failed to update content' };
    }

    return { success: true };
}

/**
 * Get pending approvals
 */
export async function getPendingApprovals() {
    const { data, error } = await supabase
        .from('approval_logs')
        .select(`
      *,
      content:content_items(*)
    `)
        .is('actioned_at', null)
        .gt('token_expires', new Date().toISOString())
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}
