import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';

export interface KnowledgeHit {
  source: string;
  article: string | null;
  title: string;
  body: string;
  /** Từ 0 đến 1. Càng cao càng khớp. */
  score: number;
}

/** Một mẩu đã tách khỏi tài liệu, trước khi ghi xuống cơ sở dữ liệu. */
interface ParsedChunk {
  source: string;
  article: string | null;
  title: string;
  body: string;
}

/**
 * Bỏ dấu tiếng Việt và hạ chữ thường.
 *
 * Dùng đúng cách chuẩn hoá này ở cả hai đầu — lúc nạp và lúc tra — vì nếu hai bên bỏ dấu
 * khác nhau thì không bao giờ khớp, mà cũng không có gì báo lỗi.
 */
export function foldAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Tách một chuỗi thành các từ. Dấu câu và chữ số ngăn cách như khoảng trắng. */
function words(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Dưới mức này thì coi như không tìm thấy, thay vì đưa ra mẩu gần đúng nhất.
 *
 * Đặt trên 0.5 là có chủ ý: khớp đúng một nửa số từ thì chưa đủ. "gia vang bao nhieu" khớp
 * mỗi chữ "vang" trong một mục nói về giáo viên vắng — một nửa số từ, mà chẳng liên quan gì.
 */
const MIN_SCORE = 0.55;

/** Gõ có dấu thì ít nhất chừng này số từ phải khớp cả dấu. */
const MIN_ACCENT_COVERAGE = 0.34;

/** Từ để hỏi, có trong mọi tài liệu nên không phân biệt được mẩu nào với mẩu nào. */
const STOP_WORDS = new Set([
  'la', 'gi', 'cua', 'va', 'cho', 'the', 'nao', 'bao', 'nhieu', 'co', 'khong', 'duoc',
  'mot', 'nhung', 'trong', 'voi', 'khi', 'thi', 'ra', 'sao', 'toi', 'ban', 'hay', 'ai',
  'may', 'phai', 'lam', 'muon', 'vi', 'nay', 'hom',
]);

/**
 * Kho tài liệu trợ lý được phép trích dẫn, và cách tìm trong đó.
 *
 * Cắt theo Điều/Khoản chứ không cắt mù theo số ký tự. Cắt giữa câu thì mẩu lấy ra không còn
 * là một quy định hoàn chỉnh, và trợ lý sẽ trích một nửa điều khoản như thể đó là toàn bộ —
 * người đọc không có cách nào biết phần còn lại nói ngược lại.
 *
 * Tra bằng `unaccent` và `pg_trgm` chứ không phải vector. Cổng mô hình đang dùng chỉ có mô
 * hình chat, không có mô hình nhúng, và bản PostgreSQL trên máy không có sẵn extension
 * `vector`. Điểm khớp được gom về một chỗ duy nhất bên dưới, nên khi nào có mô hình nhúng
 * thì đổi đúng hàm đó, phần còn lại giữ nguyên.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Tách một tài liệu Markdown thành các mẩu.
   *
   * Mỗi tiêu đề cấp hai dạng `## [nguồn] tiêu đề` mở một mẩu mới. Phần mở đầu trước tiêu đề
   * đầu tiên bị bỏ, vì nó nói về tài liệu chứ không phải là một quy định.
   */
  parse(markdown: string): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    let current: ParsedChunk | null = null;
    const lines: string[] = [];

    const flush = () => {
      if (!current) return;
      const body = lines.join('\n').trim();
      if (body) chunks.push({ ...current, body });
      lines.length = 0;
    };

    for (const line of markdown.split('\n')) {
      const heading = line.match(/^##\s+\[([^\]]+)\]\s*(.+?)\s*$/);
      if (heading) {
        flush();
        const [, label, title] = heading;
        // "Quy tắc xếp lịch, mục 4.1" -> nguồn "Quy tắc xếp lịch", số hiệu "mục 4.1"
        const split = label.match(/^(.*?),\s*((?:Điều|Khoản|mục|Mục)\s+.+)$/);
        current = split
          ? { source: split[1].trim(), article: split[2].trim(), title, body: '' }
          : { source: label.trim(), article: null, title, body: '' };
        continue;
      }

      if (current && !line.startsWith('---')) lines.push(line);
    }
    flush();

    return chunks;
  }

  /** Nạp lại toàn bộ kho từ các file nguồn. Thay hẳn, không cộng dồn. */
  async ingest(files?: string[]): Promise<{ files: number; chunks: number }> {
    const sources = files ?? [path.join(__dirname, 'regulations.md')];
    const parsed: ParsedChunk[] = [];

    for (const file of sources) {
      parsed.push(...this.parse(fs.readFileSync(file, 'utf8')));
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({});
      if (parsed.length === 0) return;

      await tx.knowledgeChunk.createMany({
        data: parsed.map((chunk) => ({
          source: chunk.source,
          article: chunk.article,
          title: chunk.title,
          body: chunk.body,
          search_text: foldAccents(`${chunk.title} ${chunk.body}`),
        })),
      });
    });

    this.logger.log(`Đã nạp ${parsed.length} mẩu tài liệu từ ${sources.length} file.`);
    return { files: sources.length, chunks: parsed.length };
  }

  /**
   * Tìm những mẩu khớp nhất với câu hỏi.
   *
   * Trả về mảng rỗng khi không có gì đủ khớp, và người gọi phải nói thẳng điều đó thay vì
   * đưa ra mẩu gần đúng nhất. Một câu trả lời sai kèm số hiệu văn bản trông đáng tin hơn hẳn
   * một câu trả lời sai không có gì kèm theo, nên nó nguy hiểm hơn.
   */
  async search(query: string, limit = 3): Promise<KnowledgeHit[]> {
    const folded = foldAccents(query).trim();
    if (!folded) return [];

    // Từ để hỏi thì có trong mọi tài liệu, nên để nguyên chúng sẽ kéo mọi mẩu lên ngang nhau
    const terms = words(folded).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    if (terms.length === 0) return [];

    // Người dùng có gõ dấu hay không quyết định được phép tin vào dấu đến mức nào
    const typedAccents = query.toLowerCase() !== folded;
    const accentedTerms = typedAccents
      ? words(query.toLowerCase()).filter((w) => w.length > 1 && !STOP_WORDS.has(foldAccents(w)))
      : [];

    const rows = await this.prisma.knowledgeChunk.findMany({
      select: { source: true, article: true, title: true, body: true, search_text: true },
    });

    const scored = rows
      .map((row) => ({
        row,
        score: this.score(
          terms,
          folded,
          row.search_text,
          foldAccents(row.title),
          accentedTerms,
          `${row.title} ${row.body}`.toLowerCase(),
        ),
      }))
      .filter((item) => item.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ row, score }) => ({
      source: row.source,
      article: row.article,
      title: row.title,
      body: row.body,
      score: Number(score.toFixed(3)),
    }));
  }

  /**
   * Điểm khớp giữa câu hỏi và một mẩu.
   *
   * Đây là chỗ duy nhất quyết định mẩu nào được chọn, nên khi thay cách tra — bằng vector
   * chẳng hạn — thì chỉ cần thay đúng hàm này.
   *
   * Khớp theo TỪ chứ không theo chuỗi con. "gia" nằm trong "giáo", nên khớp chuỗi con làm
   * câu hỏi về giá vàng trúng ngay mục nói về giáo viên.
   *
   * Và khi người dùng có gõ dấu thì dấu phải được tính. Bỏ dấu là cách duy nhất để người gõ
   * "dinh muc tiet day" vẫn tìm được, nhưng nó đồng thời làm "vàng" trùng "vắng" — hai từ
   * không liên quan gì đến nhau. Người đã gõ dấu tức là đã nói rõ họ hỏi từ nào.
   */
  private score(
    terms: string[],
    folded: string,
    haystack: string,
    title: string,
    accentedTerms: string[],
    accentedHaystack: string,
  ): number {
    const bag = new Set(words(haystack));
    const titleBag = new Set(words(title));

    let hits = 0;
    let titleHits = 0;
    for (const term of terms) {
      if (bag.has(term)) hits += 1;
      // Trùng ở tiêu đề đáng giá hơn trùng trong thân bài: tiêu đề nói mẩu đó về cái gì
      if (titleBag.has(term)) titleHits += 1;
    }
    if (hits === 0) return 0;

    if (accentedTerms.length > 0) {
      const accentBag = new Set(words(accentedHaystack));
      const accentHits = accentedTerms.filter((term) => accentBag.has(term)).length;
      // Gõ có dấu mà dấu gần như không khớp ở đâu cả thì đây là trùng do bỏ dấu, không phải
      // trùng thật
      if (accentHits / accentedTerms.length < MIN_ACCENT_COVERAGE) return 0;
    }

    const coverage = hits / terms.length;

    // Độ phủ là cửa chặn, không phải một thành phần cộng điểm. Quá NỬA số từ có nghĩa phải
    // xuất hiện thì mới xét tiếp — nếu không, một câu khớp đúng một từ vẫn được điểm thưởng
    // tiêu đề đẩy qua ngưỡng, và "gia vang bao nhieu" lại trúng mục về giáo viên vắng.
    if (coverage <= 0.5 && terms.length > 1) return 0;

    const titleBonus = (titleHits / terms.length) * 0.5;
    // Cả cụm từ xuất hiện nguyên vẹn thì gần như chắc chắn là mẩu đang tìm
    const phraseBonus = haystack.includes(folded) ? 0.5 : 0;

    return Math.min(1, coverage + titleBonus + phraseBonus);
  }
}
