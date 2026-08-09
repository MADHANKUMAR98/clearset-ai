import type { IKnowledgeService } from './types';
import type { PolicyDocument } from '../types';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';

export class LocalKnowledgeService implements IKnowledgeService {
  public async getAllPolicies(): Promise<PolicyDocument[]> {
    return POLICY_DOCUMENTS;
  }

  public async getPolicyByCode(code: string): Promise<PolicyDocument | null> {
    const doc = POLICY_DOCUMENTS.find((p) => p.code.toLowerCase() === code.toLowerCase());
    return doc || null;
  }

  public async searchPolicies(query: string): Promise<PolicyDocument[]> {
    if (!query.trim()) return POLICY_DOCUMENTS;
    const q = query.toLowerCase();
    return POLICY_DOCUMENTS.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.code.toLowerCase().includes(q) ||
        doc.sections.some(
          (s) => s.sectionTitle.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
        )
    );
  }

  public async getApplicableSOP(_failureCategory: string): Promise<{ doc: PolicyDocument; section: PolicyDocument['sections'][0] } | null> {
    const sop = POLICY_DOCUMENTS[0]; // SOP-OPS-032
    if (!sop) return null;
    const section = sop.sections[0]; // Section 3.2
    return { doc: sop, section };
  }
}

export const knowledgeService: IKnowledgeService = new LocalKnowledgeService();
