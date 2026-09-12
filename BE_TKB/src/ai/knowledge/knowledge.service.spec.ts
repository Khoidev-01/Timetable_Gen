import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeService, foldAccents } from './knowledge.service';

/**
 * Hai thứ dễ sai nhất khi tra tài liệu tiếng Việt.
 *
 * Một: bỏ dấu là cách duy nhất để người gõ "dinh muc tiet day" vẫn tìm được, nhưng nó đồng
 * thời làm "vàng" trùng "vắng" — hai từ không liên quan gì đến nhau.
 *
 * Hai: khớp chuỗi con làm "gia" trúng "giáo". Cộng hai thứ lại thì một câu hỏi về giá vàng
 * trả về một điều khoản về giáo viên vắng, kèm tên văn bản, trông rất đáng tin.
 */
const CHUNKS = [
  {
    source: 'Thông tư 05/2025/TT-BGDĐT',
    article: null,
    title: 'Định mức tiết dạy của giáo viên THPT',
    body: 'Giáo viên trung học phổ thông dạy 17 tiết mỗi tuần. Giáo viên chủ nhiệm được giảm 4 tiết mỗi tuần.',
  },
  {
    source: 'Hướng dẫn sử dụng',
    article: null,
    title: 'Giáo viên báo bận và báo vắng',
    body: 'Khi giáo viên vắng đột xuất, quản trị viên nhập ngày vắng. Hôm sau thời khóa biểu tự trở về bình thường.',
  },
  {
    source: 'Quy tắc xếp lịch',
    article: 'mục 4.3',
    title: 'Môn học trái buổi',
    body: 'Thể dục và Giáo dục quốc phòng an ninh được xếp vào buổi ngược với buổi học chính của lớp.',
  },
];

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const prisma: any = {
      knowledgeChunk: {
        findMany: async () =>
          CHUNKS.map((c) => ({ ...c, search_text: foldAccents(`${c.title} ${c.body}`) })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(KnowledgeService);
  });

  describe('cắt tài liệu', () => {
    it('cắt theo tiêu đề, tách được nguồn và số hiệu điều khoản', () => {
      const chunks = service.parse(
        [
          '# Tài liệu',
          'Phần mở đầu này nói về tài liệu, không phải một quy định.',
          '',
          '## [Thông tư 05/2025/TT-BGDĐT] Định mức tiết dạy',
          'Giáo viên THPT dạy 17 tiết mỗi tuần.',
          '',
          '## [Quy tắc xếp lịch, mục 4.1] Ràng buộc cứng',
          'Một giáo viên không thể có hai tiết cùng một lúc.',
        ].join('\n'),
      );

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({
        source: 'Thông tư 05/2025/TT-BGDĐT',
        article: null,
        title: 'Định mức tiết dạy',
      });
      expect(chunks[1]).toMatchObject({ source: 'Quy tắc xếp lịch', article: 'mục 4.1' });
      // Phần mở đầu bị bỏ: nó nói về tài liệu, trích dẫn nó ra là vô nghĩa
      expect(chunks.some((c) => c.body.includes('Phần mở đầu'))).toBe(false);
    });
  });

  describe('tra cứu', () => {
    it('gõ có dấu hay không dấu đều ra cùng một điều khoản', async () => {
      const withAccents = await service.search('định mức tiết dạy');
      const without = await service.search('dinh muc tiet day');

      expect(withAccents[0].title).toBe('Định mức tiết dạy của giáo viên THPT');
      expect(without[0].title).toBe(withAccents[0].title);
    });

    it('không trả về gì cho câu hỏi ngoài tài liệu, dù bỏ dấu có làm nó trùng chữ', async () => {
      // "vàng" bỏ dấu thành "vang", trùng "vắng"; "giá" là chuỗi con của "giáo"
      expect(await service.search('giá vàng hôm nay')).toEqual([]);
      expect(await service.search('thủ đô nước Pháp')).toEqual([]);
    });

    it('gõ không dấu cũng không lôi nhầm mẩu chỉ vì trùng chuỗi con', async () => {
      // "gia" là chuỗi con của "giao" (giáo); khớp theo chuỗi con thì câu này trúng mục
      // về giáo viên vắng. Ở đây không có dấu nên chốt dấu không giúp gì — chỉ còn phép
      // khớp theo từ đứng ra chặn.
      const hits = await service.search('gia vang bao nhieu');
      expect(hits.map((h) => h.title)).not.toContain('Giáo viên báo bận và báo vắng');
    });

    it('kèm nguồn và số hiệu để trích dẫn lại', async () => {
      const hits = await service.search('môn học trái buổi');

      expect(hits[0].source).toBe('Quy tắc xếp lịch');
      expect(hits[0].article).toBe('mục 4.3');
    });

    it('câu hỏi rỗng hoặc chỉ có từ để hỏi thì không tra gì cả', async () => {
      expect(await service.search('   ')).toEqual([]);
      expect(await service.search('là gì vậy')).toEqual([]);
    });
  });
});
