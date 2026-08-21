import type { IKnowledgeService } from './types';
import type { PolicyDocument } from '../types';
import { POLICY_DOCUMENTS } from '../data/knowledgeBase';
import { fetchCortexSearch } from './apiClient';

// ============================================================================
// LocalKnowledgeService — reads from local knowledgeBase.ts (must not be removed)
// ============================================================================
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

// ============================================================================
// HybridKnowledgeService
// Uses Cortex Search (POST /api/cortex/search) when live Snowflake is available.
// Falls back to LocalKnowledgeService for all policy lookups.
//
// Cortex Search results are returned as raw chunks from POLICY_CHUNKS.
// When available, searchPolicies() enriches results with local full-doc data
// where possible, providing a merged view.
// ============================================================================
class HybridKnowledgeService implements IKnowledgeService {
  private local: LocalKnowledgeService;

  constructor(local: LocalKnowledgeService) {
    this.local = local;
  }

  public async getAllPolicies(): Promise<PolicyDocument[]> {
    // Full policy documents are only in local knowledgeBase.ts
    return this.local.getAllPolicies();
  }

  public async getPolicyByCode(code: string): Promise<PolicyDocument | null> {
    return this.local.getPolicyByCode(code);
  }

  /**
   * searchPolicies — uses Cortex Search when available, falls back to local.
   *
   * NOTE: The Cortex Search service returns raw POLICY_CHUNKS (flat text chunks).
   * We attempt to match returned doc codes back to full PolicyDocument objects.
   * If no match is found, we still return the local search results as fallback.
   */
  public async searchPolicies(query: string): Promise<PolicyDocument[]> {
    if (!query.trim()) return this.local.getAllPolicies();

    try {
      const response = await fetchCortexSearch(query.trim(), 5);

      if (response.success && response.mode === 'snowflake' && response.results.length > 0) {
        // Map Cortex Search chunk results back to full PolicyDocument objects
        const matchedDocCodes = new Set<string>();
        for (const result of response.results) {
          const docCode = result['DOC_CODE'] as string | undefined;
          if (docCode) {
            matchedDocCodes.add(docCode);
          }
        }

        // Find matching full policy documents by DOC_CODE → policy.code
        const matchedDocs: PolicyDocument[] = [];
        for (const docCode of matchedDocCodes) {
          const doc = await this.local.getPolicyByCode(docCode);
          if (doc) {
            matchedDocs.push(doc);
          }
        }

        // If we matched any full documents via Cortex, return those
        if (matchedDocs.length > 0) {
          return matchedDocs;
        }

        // Cortex returned results but we couldn't map them to full docs —
        // fall through to local search
      }
    } catch {
      // Cortex Search unavailable — fall through to local
    }

    return this.local.searchPolicies(query);
  }

  public async getApplicableSOP(failureCategory: string): Promise<{ doc: PolicyDocument; section: PolicyDocument['sections'][0] } | null> {
    // getApplicableSOP is not driven by Cortex Search in Stage 3
    return this.local.getApplicableSOP(failureCategory);
  }
}

export const knowledgeService: IKnowledgeService = new HybridKnowledgeService(
  new LocalKnowledgeService(),
);
