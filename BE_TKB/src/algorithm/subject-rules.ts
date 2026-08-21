/**
 * Single source of truth for subject-category rules used by the scheduling
 * algorithm and the constraint/fitness evaluator.
 *
 * Previously these lists were copy-pasted across algorithm.service.ts and
 * constraint.service.ts with subtle differences (especially the HC8
 * "opposite-session-allowed" set), which made the saved fitness score, the
 * displayed violations, and the Phase-3 optimisation cost disagree with each
 * other. Keep every category here and import it everywhere.
 *
 * All comparisons are done with `code.includes(x)` on the UPPER-CASED subject
 * code, matching the historical behaviour (so e.g. "VAT_LY" matches "LY").
 */

/** Heavy academic subjects — at most a limited number per session per class. */
export const HEAVY_CODES = [
    'TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC',
] as const;

/** Block subjects — should be scheduled as 2 consecutive periods (SC4) and obey block rules R1-R3. */
export const BLOCK_CODES = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'] as const;

/** Priority subjects — placed in earlier periods first. */
export const PRIORITY_CODES = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'] as const;

/**
 * Subjects allowed in the OPPOSITE session of the class's main session
 * (no HC8 "sai buổi" penalty). Per GDPT 2018: physical/defence education and
 * the experiential / local-education activities are flexible.
 */
export const OPPOSITE_ALLOWED_CODES = ['GDTC', 'GDQP', 'QUOC_PHONG', 'HDTN', 'GDDP'] as const;

/**
 * Outdoor subjects that may only occupy the "cool" periods (HC5):
 * morning P1-3, afternoon P8-10.
 */
export const OUTDOOR_CODES = ['GDTC', 'GDQP', 'QUOC_PHONG'] as const;

/**
 * Special activity subjects that bypass the session check entirely
 * (placed by Phase 1 fixed-slot logic).
 */
export const SPECIAL_BYPASS_CODES = ['CHAO_CO', 'SH_CUOI', 'SHCN'] as const;

const includesAny = (code: string, list: readonly string[]) =>
    list.some((c) => code.includes(c));

export const isHeavy = (code: string) => includesAny(code, HEAVY_CODES);
export const isBlock = (code: string) => includesAny(code, BLOCK_CODES);
export const isPriority = (code: string) => includesAny(code, PRIORITY_CODES);
export const isOppositeAllowed = (code: string) => includesAny(code, OPPOSITE_ALLOWED_CODES);
export const isOutdoor = (code: string) => includesAny(code, OUTDOOR_CODES);
export const isSpecialBypass = (code: string) => includesAny(code, SPECIAL_BYPASS_CODES);

/**
 * True if the subject is exempt from the HC8 main-session rule, i.e. it may be
 * placed in either session without penalty.
 */
export const isSessionExempt = (code: string) =>
    isOppositeAllowed(code) || isSpecialBypass(code);
